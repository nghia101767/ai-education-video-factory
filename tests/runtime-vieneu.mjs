// Run inside worker: node tests/runtime-vieneu.mjs. Adds test records; never drops data.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
const base = process.env.E2E_BASE_URL || "http://web:3000";
const voice = process.env.E2E_VOICE || "default";
let cookie = "";
async function api(url, body) {
  const response = await fetch(base + url, { method: body === undefined ? "GET" : "POST", headers: { cookie, "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json(); assert.ok(response.ok, `${url}: ${response.status} ${JSON.stringify(data)}`);
  return data;
}
const login = await fetch(base + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }) });
assert.equal(login.status, 200); cookie = login.headers.get("set-cookie").split(";")[0];
const health = await api("/api/health/tts"); assert.equal(health.provider, "vieneu"); assert.equal(health.available, true);
const suffix = Date.now();
const subject = await api("/api/content/subjects", { name: `VieNeu E2E ${suffix}`, status: "active" });
const grades = await api("/api/content/grades"); const grade = grades.items[0] || await api("/api/content/grades", { name: "Lớp 1", level: 1, order: 1, status: "active" });
const textbook = await api("/api/content/textbooks", { name: `VieNeu ${suffix}`, subjectId: subject._id, gradeId: grade._id, status: "active" });
const lesson = await api("/api/content/lessons", { title: `VieNeu Phân số ${suffix}`, textbookId: textbook._id, subjectId: subject._id, gradeId: grade._id, summary: "Phân số mô tả các phần bằng nhau của một tổng thể.", objectives: ["Nhận biết tử số và mẫu số"], keyConcepts: ["tử số", "mẫu số"], status: "draft" });
await api(`/api/lessons/${lesson._id}/analyze`, {});
const script = await api(`/api/lessons/${lesson._id}/scripts/generate`, {});
await api(`/api/scripts/${script._id}/approve`, {});
const storyboard = await api(`/api/scripts/${script._id}/storyboard`, {});
for (const scene of storyboard.scenes) await api(`/api/scenes/${scene._id}/generate-asset`, {});
async function waitJob(url) {
  let job;
  for (let attempt = 0; attempt < 1200; attempt++) {
    job = await api(url);
    if (["completed", "failed", "cancelled"].includes(job.status)) break;
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  assert.equal(job.status, "completed", JSON.stringify(job)); return job;
}
const first = await api(`/api/scripts/${script._id}/audio`, { voice, force: true });
await waitJob(`/api/jobs/${first.jobId}`);
const second = await api(`/api/scripts/${script._id}/audio`, { voice });
const cached = await waitJob(`/api/jobs/${second.jobId}`); assert.equal(cached.payload.result.cached, true);
const scenes = await api(`/api/scripts/${script._id}/scenes`);
const assets = scenes.map(scene => scene.assetIds.find(asset => asset.type === "audio"));
for (const asset of assets) { assert.equal(asset.provider, "vieneu"); assert.equal(asset.status, "generated"); assert.equal(asset.metadata.sampleRate, 48000); assert.ok(asset.metadata.duration > 0); }
const queued = await api(`/api/videos/${storyboard.videoId}/render`, {});
const render = await waitJob(`/api/render-jobs/${queued._id}`);
function probe(value) {
  const filename = path.isAbsolute(value) ? value : path.join(process.env.STORAGE_ROOT || "/app/storage", value);
  assert.ok(fs.statSync(filename).size > 44);
  return JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", filename], { encoding: "utf8" }));
}
const wav = probe(assets[0].storagePath), mp4 = probe(render.outputPath);
assert.ok(mp4.streams.some(s => s.codec_type === "video")); assert.ok(mp4.streams.some(s => s.codec_type === "audio"));
assert.ok(Math.abs(Number(mp4.format.duration) - cached.payload.result.duration) < 1, "Video/audio timing differs by more than one second");
const preview = await fetch(base + "/api/media?path=" + encodeURIComponent(assets[0].storagePath), { headers: { cookie, range: "bytes=0-43" } }); assert.equal(preview.status, 206);
const subtitles = await api(`/api/videos/${storyboard.videoId}/subtitles`);
assert.ok(subtitles.content.includes("-->")); assert.equal(subtitles.entries.length, scenes.length);
await mongoose.connect(process.env.MONGODB_URI);
const usages = await mongoose.connection.collection("aiusages").find({ scriptId: new mongoose.Types.ObjectId(script._id), provider: "vieneu", status: "success" }).toArray();
assert.equal(usages.length, scenes.length * 2);
assert.ok(usages.every(u => u.providerType === "local" && u.estimatedCost === 0 && u.audioSeconds > 0));
assert.equal(usages.filter(u => u.cached).length, scenes.length);
assert.equal(usages.filter(u => !u.cached).length, scenes.length);
await mongoose.disconnect();
const report = { status: "PASS", lessonId: lesson._id, lessonTitle: lesson.title, scriptId: script._id, videoId: storyboard.videoId, ttsJobId: first.jobId, cacheJobId: second.jobId, provider: "vieneu", voice, model: assets[0].model, audio: assets[0].storagePath, audioDuration: Number(wav.format.duration), audioSampleRate: 48000, video: render.outputPath, videoDuration: Number(mp4.format.duration), narrationDuration: cached.payload.result.duration, subtitle: render.subtitlePath, container: "tts", cache: "HIT", assets: assets.map(a => ({ id: a._id, path: a.storagePath, metadata: a.metadata })) };
fs.mkdirSync(path.join(process.env.STORAGE_ROOT || "/app/storage", "logs"), { recursive: true });
fs.writeFileSync(path.join(process.env.STORAGE_ROOT || "/app/storage", "logs/vieneu-e2e.json"), JSON.stringify({ ...report, usageCount: usages.length }, null, 2));
console.log(JSON.stringify(report, null, 2));
