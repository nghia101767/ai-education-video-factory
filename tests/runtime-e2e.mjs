import assert from "node:assert/strict";

const baseUrl = process.env.E2E_BASE_URL || "http://localhost:3000";
const email = process.env.E2E_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "admin@huunghia.dev";
const password = process.env.E2E_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "12345678";
let cookie = "";

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (cookie) headers.set("cookie", cookie);
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers, redirect: "manual" });
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { response, body };
}

async function expectJson(path, options, expectedStatus) {
  const result = await request(path, options);
  assert.ok((Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus]).includes(result.response.status), `${options?.method || "GET"} ${path}: ${result.response.status} ${JSON.stringify(result.body)}`);
  return result.body;
}

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const unauthenticated = await request("/api/dashboard");
assert.equal(unauthenticated.response.status, 401);

const login = await request("/api/auth/login", {
  method: "POST",
  headers: { "content-type": "application/json", "x-forwarded-proto": "https" },
  body: JSON.stringify({ email, password }),
});
assert.equal(login.response.status, 200, JSON.stringify(login.body));
const setCookie = login.response.headers.get("set-cookie") || "";
assert.match(setCookie, /HttpOnly/i);
assert.match(setCookie, /SameSite=Lax/i);
assert.match(setCookie, /Secure/i);
cookie = setCookie.split(";")[0];
assert.equal((await expectJson("/api/auth/session", {}, 200)).user.email, email);

for (const page of ["/dashboard", "/dashboard/subjects", "/dashboard/grades", "/dashboard/textbooks", "/dashboard/lessons", "/dashboard/assets", "/dashboard/characters", "/dashboard/styles", "/dashboard/videos", "/dashboard/render-queue", "/dashboard/batch", "/dashboard/analytics", "/dashboard/analytics/cost", "/dashboard/settings", "/dashboard/youtube", "/dashboard/help"]) {
  const result = await request(page);
  assert.equal(result.response.status, 200, `Dashboard route failed: ${page}`);
  assert.match(String(result.body), /<!DOCTYPE html>/i);
}

await expectJson("/api/content/subjects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "" }) }, 400);
const subject = await expectJson("/api/content/subjects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: `E2E Toán ${suffix}`, description: "Runtime verified", status: "active" }) }, 201);
const currentGrades = await expectJson("/api/content/grades", {}, 200);
const freeLevel = Array.from({ length: 12 }, (_, index) => index + 1).find((level) => !currentGrades.items.some((item) => item.level === level));
const grade = freeLevel
  ? await expectJson("/api/content/grades", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: `E2E Lớp ${suffix}`, level: freeLevel, order: Date.now(), status: "active" }) }, 201)
  : currentGrades.items[0];
const textbook = await expectJson("/api/content/textbooks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: `E2E Chân trời ${suffix}`, publisher: "E2E Publisher", edition: "2026", subjectId: subject._id, gradeId: grade._id, status: "active" }) }, 201);
await expectJson("/api/content/lessons", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "Invalid lesson", unexpected: true }) }, 400);
const lesson = await expectJson("/api/content/lessons", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: `E2E Phân số ${suffix}`, textbookId: textbook._id, subjectId: subject._id, gradeId: grade._id, chapter: "Phân số", lessonNumber: 1, summary: "Phân số mô tả các phần bằng nhau của một tổng thể.", objectives: ["Nhận biết tử số và mẫu số"], keyConcepts: ["tử số", "mẫu số"], status: "draft" }) }, 201);

const sourceForm = new FormData();
sourceForm.append("lessonId", lesson._id);
sourceForm.append("file", new File(["Bài học phân số bằng tiếng Việt. Tử số nằm trên, mẫu số nằm dưới."], `lesson-${suffix}.txt`, { type: "text/plain" }));
const source = await expectJson("/api/content/source-documents/upload", { method: "POST", body: sourceForm }, 201);
assert.equal(source.processingStatus, "READY");
assert.equal(source.hash.length, 64);
const spoofedForm = new FormData(); spoofedForm.append("lessonId", lesson._id); spoofedForm.append("file", new File(["not png"], "spoof.png", { type: "image/png" }));
await expectJson("/api/content/source-documents/upload", { method: "POST", body: spoofedForm }, 400);

const analysisFirst = await expectJson(`/api/lessons/${lesson._id}/analyze`, { method: "POST" }, 201);
const analysisSecond = await expectJson(`/api/lessons/${lesson._id}/analyze`, { method: "POST" }, 200);
assert.equal(analysisSecond.cached, true);
assert.equal(String(analysisFirst.provider), "mock-local");

const scriptFirst = await expectJson(`/api/lessons/${lesson._id}/scripts/generate`, { method: "POST" }, 201);
assert.ok(scriptFirst.duration >= 25 && scriptFirst.duration <= 35);
const scriptSecond = await expectJson(`/api/lessons/${lesson._id}/scripts/generate`, { method: "POST" }, 200);
assert.equal(String(scriptSecond._id), String(scriptFirst._id));
const script = await expectJson(`/api/scripts/${scriptFirst._id}/approve`, { method: "POST" }, 200);
assert.equal(script.status, "approved");

const storyboard = await expectJson(`/api/scripts/${script._id}/storyboard`, { method: "POST" }, 201);
assert.ok(storyboard.scenes.length >= 5 && storyboard.scenes.length <= 7);
assert.equal(storyboard.validation.valid, true);
const storyboardCached = await expectJson(`/api/scripts/${script._id}/storyboard`, { method: "POST" }, 200);
assert.equal(storyboardCached.cached, true);

const character = await expectJson("/api/characters", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: `E2E Cô giáo ${suffix}`, appearance: "Giáo viên áo xanh", visualStyle: "friendly educational illustration", tags: "teacher, e2e" }) }, 201);
const style = await expectJson("/api/styles", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: `E2E Style ${suffix}`, visualPromptPrefix: "Clean educational poster", negativePrompt: "blurry text", aspectRatio: "9:16" }) }, 201);
await expectJson(`/api/scenes/${storyboard.scenes[0]._id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ characterProfileId: character._id, stylePresetId: style._id }) }, 200);
let firstImage;
for (const scene of storyboard.scenes) {
  const generated = await request(`/api/scenes/${scene._id}/generate-asset`, { method: "POST" });
  assert.ok([200, 201].includes(generated.response.status), JSON.stringify(generated.body));
  const asset = generated.body;
  assert.equal(asset.status, "mock");
  firstImage ||= asset;
  const reused = await expectJson(`/api/scenes/${scene._id}/generate-asset`, { method: "POST" }, 200);
  assert.equal(reused.reused, true);
}
const assigned = await expectJson(`/api/scenes/${storyboard.scenes.at(-1)._id}/assets`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ assetId: firstImage._id }) }, 200);
assert.equal(assigned.assetIds.filter((asset) => asset.type === "image").length, 1);
async function queueAudio() {
  const queued = await expectJson(`/api/scripts/${script._id}/audio`, { method: "POST" }, 202);
  let job;
  for (let attempt = 0; attempt < 900; attempt++) {
    job = await expectJson(`/api/jobs/${queued.jobId}`, {}, 200);
    if (["completed", "failed", "cancelled"].includes(job.status)) break;
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  assert.equal(job.status, "completed", JSON.stringify(job));
  const scenes = await expectJson(`/api/scripts/${script._id}/scenes`, {}, 200);
  return { assets: scenes.map(scene => ({ ...scene.assetIds.find(asset => asset.type === "audio"), reused: job.payload.result.cached })) };
}
const audio = await queueAudio();
assert.equal(audio.assets.length, storyboard.scenes.length);
const cachedAudio = await queueAudio();
assert.ok(cachedAudio.assets.every((asset) => asset.reused));
const voiceFile = await fetch(`${baseUrl}/api/media?path=${encodeURIComponent(audio.assets[0].storagePath)}`, { headers: { cookie } }); assert.equal(voiceFile.status, 200); const voiceBytes = await voiceFile.arrayBuffer();
const musicForm = new FormData(); musicForm.append("type", "music"); musicForm.append("file", new File([voiceBytes], `music-${suffix}.wav`, { type: "audio/wav" })); const music = await expectJson("/api/assets", { method: "POST", body: musicForm }, [200, 201]);
const sfxForm = new FormData(); sfxForm.append("type", "sfx"); sfxForm.append("file", new File([voiceBytes], `sfx-${suffix}.wav`, { type: "audio/wav" })); const sfx = await expectJson("/api/assets", { method: "POST", body: sfxForm }, [200, 201]);
await expectJson(`/api/videos/${storyboard.videoId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ backgroundMusicAssetId: music._id }) }, 200);
await expectJson(`/api/scenes/${storyboard.scenes[0]._id}/assets`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ assetId: sfx._id }) }, 200);

const queued = await expectJson(`/api/videos/${storyboard.videoId}/render`, { method: "POST" }, 202);
assert.equal(queued.renderSettings.width, 1080); assert.equal(queued.renderSettings.height, 1920); assert.equal(queued.renderSettings.fps, 30); assert.equal(queued.renderSettings.subtitleMargin, 300); assert.equal(queued.renderSettings.backgroundMusicPath, music.storagePath);
let render = queued;
for (let attempt = 0; attempt < 120 && !["completed", "failed", "cancelled"].includes(render.status); attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  render = await expectJson(`/api/render-jobs/${queued._id}`, {}, 200);
}
assert.equal(render.status, "completed", JSON.stringify(render));
assert.equal(render.progress, 100);
assert.ok(render.outputPath && render.subtitlePath);
const videoBytes = await request(`/api/media?path=${encodeURIComponent(render.outputPath)}`, { headers: { range: "bytes=0-31" } });
assert.equal(videoBytes.response.status, 206);
assert.match(videoBytes.response.headers.get("content-type") || "", /video\/mp4/);
const subtitles = await expectJson(`/api/videos/${storyboard.videoId}/subtitles`, { method: "POST" }, 201); assert.equal(subtitles.entries.length, storyboard.scenes.length); assert.match(subtitles.content, /-->/);
subtitles.entries[0].text = "Phụ đề tiếng Việt E2E";
const editedSubtitles = await expectJson(`/api/videos/${storyboard.videoId}/subtitles`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ entries: subtitles.entries }) }, 200); assert.match(editedSubtitles.content, /Phụ đề tiếng Việt E2E/);
const download = await request(`/api/videos/${storyboard.videoId}/download`); assert.equal(download.response.status, 200); assert.match(download.response.headers.get("content-disposition") || "", /attachment/);
const approvedVideo = await expectJson(`/api/videos/${storyboard.videoId}/approve`, { method: "POST" }, 200);
assert.equal(approvedVideo.status, "approved");
const mockPublish = await expectJson(`/api/videos/${storyboard.videoId}/publish`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ privacyStatus: "private" }) }, 200);
assert.equal(mockPublish.mode, "mock"); assert.equal(mockPublish.published, false); assert.equal(mockPublish.status, "mock_completed");
const stillApproved = await expectJson(`/api/videos/${storyboard.videoId}`, {}, 200); assert.equal(stillApproved.status, "approved");
const analyticsPreview = await expectJson("/api/analytics", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }, 200); assert.equal(analyticsPreview.persisted, false);
await expectJson("/api/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ render: { width: 1080, height: 1920, fps: 30, subtitleMargin: 300 }, youtube: { privacyStatus: "public" } }) }, 400);
await expectJson("/api/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ render: { width: 1080, height: 1920, fps: 30, subtitleMargin: 300 }, youtube: { privacyStatus: "private" } }) }, 200);
await expectJson("/api/media?path=../../etc/passwd", {}, 400);

const usages = await expectJson("/api/analytics/cost", {}, 200);
assert.ok(usages.summary.some((row) => row.cachedRequests > 0));
const dashboard = await expectJson("/api/dashboard", {}, 200);
assert.ok(dashboard.counts.lessons >= 1 && dashboard.counts.videos >= 1);
const analytics = await expectJson("/api/analytics", {}, 200); assert.ok(Object.values(analytics.summary.videos).reduce((sum, value) => sum + value, 0) >= 1);

await expectJson("/api/auth/logout", { method: "POST" }, 200);
const invalidated = await request("/api/auth/session");
assert.equal(invalidated.response.status, 401);

console.log(JSON.stringify({ status: "PASS", subjectId: subject._id, gradeId: grade._id, textbookId: textbook._id, lessonId: lesson._id, scriptId: script._id, characterId: character._id, styleId: style._id, videoId: storyboard.videoId, renderJobId: queued._id, outputPath: render.outputPath, subtitlePath: render.subtitlePath }, null, 2));
