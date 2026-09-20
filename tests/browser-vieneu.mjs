// Run after runtime-vieneu.mjs. Uses its additive fixture, never deletes data.
// Credentials come from the environment and are never written to reports.
import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium, expect } from "@playwright/test";

const fixture = JSON.parse(fs.readFileSync("storage/logs/vieneu-e2e.json", "utf8"));
const base = process.env.E2E_BASE_URL || "http://localhost:3000";
assert.ok(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD, "ADMIN_EMAIL and ADMIN_PASSWORD required");
const channel = process.env.E2E_BROWSER_CHANNEL;
const browser = await chromium.launch(channel ? { channel } : {});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(base + "/login");
  await page.getByPlaceholder("Email", { exact: true }).fill(process.env.ADMIN_EMAIL);
  await page.getByPlaceholder("Password", { exact: true }).fill(process.env.ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/dashboard**");
  await page.goto(`${base}/dashboard/videos/${fixture.videoId}`);
  await expect(page.getByRole("heading", { name: "Voice · VieNeu-TTS", exact: true })).toBeVisible();
  const voice = page.getByRole("combobox", { name: "Voice", exact: true });
  await expect(voice.locator("option")).toHaveCount(24);
  await voice.selectOption(fixture.voice);
  await expect(voice).toHaveValue(fixture.voice);
  const queuedResponse = page.waitForResponse(response => response.url().endsWith(`/api/scripts/${fixture.scriptId}/audio`) && response.request().method() === "POST");
  await page.getByRole("button", { name: "Generate/reuse voice", exact: true }).click();
  const queued = await queuedResponse;
  assert.equal(queued.status(), 202);
  const { jobId } = await queued.json();
  await expect(page.getByRole("status")).toHaveText("Generating...");
  await expect(voice).toBeDisabled();
  await expect(page.getByRole("status")).toHaveText("Voice ready. Audio and subtitles updated.", { timeout: 120000 });
  const job = await (await page.request.get(`${base}/api/jobs/${jobId}`)).json();
  assert.equal(job.status, "completed");
  assert.equal(job.payload.result.cached, true);
  await page.reload();
  await expect(page.getByRole("status")).toHaveText("Voice ready. Audio and subtitles updated.");
  await expect(voice).toHaveValue(fixture.voice);
  await expect(page.locator("audio")).toHaveCount(fixture.assets.length);
  const media = page.locator("audio").first();
  await expect.poll(() => media.evaluate(element => element.readyState)).toBeGreaterThanOrEqual(1);
  const duration = await media.evaluate(element => element.duration);
  assert.ok(duration > 0);
  await media.evaluate(element => element.play());
  await expect.poll(() => media.evaluate(element => element.currentTime)).toBeGreaterThan(0.1);
  await media.evaluate(element => element.pause());
  assert.equal(await media.evaluate(element => element.paused), true);
  const seekTarget = duration / 2;
  await media.evaluate((element, target) => { element.currentTime = target; }, seekTarget);
  await expect.poll(() => media.evaluate(element => element.seeking)).toBe(false);
  assert.ok(Math.abs(await media.evaluate(element => element.currentTime) - seekTarget) < 0.2);
  assert.equal(await media.evaluate(element => element.error), null);
  const video = page.locator("video");
  await expect.poll(() => video.evaluate(element => element.readyState)).toBeGreaterThanOrEqual(1);
  await video.evaluate(element => { element.muted = true; return element.play(); });
  await expect.poll(() => video.evaluate(element => element.currentTime)).toBeGreaterThan(0.1);
  await video.evaluate(element => element.pause());
  assert.equal(await video.evaluate(element => element.error), null);
  await page.screenshot({ path: "storage/logs/vieneu-browser.png", fullPage: true });
  assert.deepEqual(errors, []);
  const report = { status: "PASS", browser: channel || "chromium", browserVersion: browser.version(), videoId: fixture.videoId, jobId, voice: fixture.voice, cache: "HIT", audioDuration: duration, login: true, voiceSelection: true, polling: true, reloadStatus: true, mediaPlayPauseSeek: true, pageErrors: errors, testedAt: new Date().toISOString() };
  fs.writeFileSync("storage/logs/vieneu-browser.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
