// Additive Step-7-only real E2E. Uses an existing LessonAnalysis and never invokes analysis or downstream generation.
import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium, expect } from "@playwright/test";
const base = process.env.E2E_BASE_URL || "http://localhost:3000";
const lessonId = "6aa485a49e66fcef87df1689";
const analysisId = "6aa485ae9e66fcef87df16d8";
const browser = await chromium.launch();
try {
  const page = await browser.newPage(); const pageErrors = []; page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto(base + "/login");
  await page.getByPlaceholder("Email", { exact: true }).fill(process.env.ADMIN_EMAIL);
  await page.getByPlaceholder("Password", { exact: true }).fill(process.env.ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click(); await page.waitForURL("**/dashboard**");
  async function request(url, data = {}, expected = [200, 201]) { const response = await page.request.post(base + url, { data, timeout: 720000 }); const body = await response.json(); assert.ok(expected.includes(response.status()), `${url}: ${response.status()} ${JSON.stringify(body)}`); return { body, status: response.status() }; }
  const health = await (await page.request.get(base + "/api/health/script")).json(); assert.equal(health.provider, "openai"); assert.equal(health.configured, true);
  const analysisBefore = await (await page.request.get(`${base}/api/lessons/${lessonId}/analyze`)).json(); assert.ok(analysisBefore.some(item => item._id === analysisId));
  const runMarker = new Date().toISOString(); const initialInstruction = `Giải thích thân thiện, rõ ràng cho học sinh lớp hai. Mã kiểm chứng ${runMarker}.`;
  const generated = await request(`/api/lessons/${lessonId}/scripts/generate`, { analysisId, instruction: initialInstruction, style: "engaging" });
  assert.equal(generated.status, 201); assert.equal(generated.body.cached, false); assert.equal(generated.body.provider, "openai"); assert.equal(generated.body.analysisId, analysisId); assert.equal(generated.body.schemaVersion, "script-schema-v2"); assert.equal(generated.body.promptVersion, "script-generation-v2");
  const cached = await request(`/api/lessons/${lessonId}/scripts/generate`, { analysisId, instruction: initialInstruction, style: "engaging" }, [200]);
  assert.equal(cached.body.cached, true); assert.equal(cached.body._id, generated.body._id);
  const direct = await (await page.request.get(`${base}/api/scripts/${generated.body._id}`)).json(); assert.equal(direct._id, generated.body._id);
  const metadata = { analysisId: direct.analysisId, provider: direct.provider, model: direct.model, requestedModel: direct.requestedModel, promptVersion: direct.promptVersion, schemaVersion: direct.schemaVersion, cacheKey: direct.cacheKey, usage: direct.usage };
  const editedTitle = `${direct.title} — đã biên tập`;
  const saved = await request(`/api/scripts/${direct._id}/save`, { title: editedTitle }); assert.equal(saved.body.title, editedTitle); assert.equal(saved.body.status, "draft"); assert.equal(saved.body.manuallyEdited, true);
  for (const [key, value] of Object.entries(metadata)) assert.deepEqual(saved.body[key], value, `manual save changed ${key}`);
  const approved = await request(`/api/scripts/${direct._id}/approve`); assert.equal(approved.body.status, "approved"); assert.ok(approved.body.approvedAt);
  const rejected = await request(`/api/scripts/${direct._id}/reject`); assert.equal(rejected.body.status, "rejected"); assert.ok(rejected.body.rejectedAt); assert.equal(rejected.body.approvedAt, undefined);
  const regenerated = await request(`/api/scripts/${direct._id}/regenerate`, { instruction: "Dùng một câu hỏi mở đầu khác và vẫn chỉ dựa trên phân tích.", style: "clear" });
  assert.equal(regenerated.status, 201); assert.equal(regenerated.body.cached, false); assert.equal(regenerated.body.analysisId, analysisId); assert.equal(regenerated.body.version, direct.version + 1); assert.notEqual(regenerated.body._id, direct._id);
  await page.goto(`${base}/dashboard/lessons/${lessonId}`); const studio = page.getByTestId("script-studio");
  await expect(studio.getByTestId("script-provider")).toContainText("OpenAI"); await expect(studio.getByTestId("script-provider")).toContainText("gpt-5.6-luna");
  await expect(studio.locator(`[data-script-id="${regenerated.body._id}"]`)).toContainText("script-schema-v2"); await expect(studio.locator(`[data-script-id="${direct._id}"]`)).toContainText(editedTitle);
  await page.reload(); await expect(page.locator(`[data-script-id="${regenerated.body._id}"]`)).toBeVisible();
  assert.deepEqual(pageErrors, []); await page.screenshot({ path: "storage/logs/script-openai.png", fullPage: true });
  const report = { status: "PASS", testedAt: new Date().toISOString(), runMarker, initialInstruction, lessonId, analysisId, initialScriptId: direct._id, regeneratedScriptId: regenerated.body._id, initialVersion: direct.version, regeneratedVersion: regenerated.body.version, provider: regenerated.body.provider, requestedModel: regenerated.body.requestedModel, actualModel: regenerated.body.model, promptVersion: regenerated.body.promptVersion, schemaVersion: regenerated.body.schemaVersion, initialUsage: direct.usage, regeneratedUsage: regenerated.body.usage, initialCacheKey: direct.cacheKey, cache: { missScriptId: generated.body._id, hitScriptId: cached.body._id }, manualSaveMetadataPreserved: true, approveReject: true, uiReload: true, pageErrors };
  fs.writeFileSync("storage/logs/script-openai.json", JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
