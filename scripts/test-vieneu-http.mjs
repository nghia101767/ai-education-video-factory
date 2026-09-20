// Invoke in worker container. Exercises internal HTTP, shared files, errors and warm inference.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const base = process.env.VIENEU_TTS_URL || "http://tts:8000";
const text = "Xin chào các em học sinh. Hôm nay chúng ta sẽ học một bài học mới.";
async function generate(body) {
  const response = await fetch(base + "/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(900000) });
  return { status: response.status, data: await response.json() };
}
const healthResponse = await fetch(base + "/health"); assert.equal(healthResponse.status, 200);
const health = await healthResponse.json(); assert.equal(health.backend, "onnx");
const invalid = [];
for (const body of [{ text: "" }, { text, voice: "no-such-preset" }, { text, voice: {} }, { text, referenceAudio: "../bad.wav" }, { text, filename: "../bad.wav" }, { text, speed: 2 }]) {
  const result = await generate(body); assert.equal(result.status, 422, JSON.stringify(result)); invalid.push(result.data);
}
const runs = [];
for (let index = 0; index < 3; index++) {
  const result = await generate({ text, voice: "default", filename: index === 0 ? "test-vieneu.wav" : `test-vieneu-${index + 1}.wav` });
  assert.equal(result.status, 200, JSON.stringify(result)); assert.equal(result.data.success, true);
  const filename = path.join(process.env.STORAGE_ROOT || "/app/storage", result.data.audioPath);
  const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", filename], { encoding: "utf8" }));
  assert.ok(Number(probe.format.duration) > 0); assert.ok(Number(probe.format.size) > 44);
  assert.ok(probe.streams.some(s => s.codec_type === "audio" && s.sample_rate === "48000" && s.channels === 1 && s.codec_name === "pcm_s16le"));
  const pcm = execFileSync("ffmpeg", ["-v", "error", "-i", filename, "-f", "f32le", "-acodec", "pcm_f32le", "-"], { maxBuffer: 32 * 1024 * 1024 });
  let squares = 0;
  for (let offset = 0; offset < pcm.length; offset += 4) squares += pcm.readFloatLE(offset) ** 2;
  const rms = Math.sqrt(squares / (pcm.length / 4)); assert.ok(rms > 0.0001, "WAV must not be silent");
  result.data.rms = rms;
  runs.push(result.data);
  console.log(JSON.stringify({ run: index + 1, ...result.data }));
}
const report = { status: "PASS", health, invalid, runs, averageInferenceMs: runs.reduce((sum, r) => sum + r.inferenceMs, 0) / runs.length };
const root = process.env.STORAGE_ROOT || "/app/storage";
fs.mkdirSync(path.join(root, "logs"), { recursive: true });
fs.writeFileSync(path.join(root, "logs/vieneu-http.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
