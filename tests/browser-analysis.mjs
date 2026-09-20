// Additive step-6-only E2E. Does not generate scripts/images/video or delete data.
import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium, expect } from "@playwright/test";
const base = process.env.E2E_BASE_URL || "http://localhost:3000";
const expected = process.env.E2E_ANALYSIS_PROVIDER || "mock";
const missingKey = process.env.E2E_ANALYSIS_MISSING_KEY === "true";
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto(base + "/login");
  await page.getByPlaceholder("Email", { exact: true }).fill(process.env.ADMIN_EMAIL);
  await page.getByPlaceholder("Password", { exact: true }).fill(process.env.ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/dashboard**");
  async function api(url, data) {
    const response = data === undefined ? await page.request.get(base + url) : await page.request.post(base + url, { data });
    assert.ok(response.ok(), `${url}: ${response.status()}`); return response.json();
  }
  const health = await api("/api/health/analysis"); assert.equal(health.provider, expected);
  assert.equal(health.configured, !missingKey);
  const suffix = Date.now();
  const subject = await api("/api/content/subjects", { name: `Analysis E2E Toán ${suffix}`, status: "active" });
  const grades = await api("/api/content/grades");
  const grade = grades.items.find(item => item.level === 2) || await api("/api/content/grades", { name: "Lớp 2", level: 2, order: 2, status: "active" });
  const textbook = await api("/api/content/textbooks", { name: `Tài liệu kiểm chứng Analysis ${suffix}`, subjectId: subject._id, gradeId: grade._id, status: "active" });
  const lesson = await api("/api/content/lessons", { title: `Một phần hai — Analysis ${suffix}`, subjectId: subject._id, gradeId: grade._id, textbookId: textbook._id, summary: "Bài học về một phần hai dành cho học sinh lớp 2.", objectives: ["Nhận biết một phần hai của một hình"], keyConcepts: ["Hai phần bằng nhau"], status: "draft" });
  const source = "Một phần hai\nChia một hình thành hai phần bằng nhau, lấy một phần thì được một phần hai của hình. Viết là 1/2. Ví dụ: chia một hình tròn thành hai phần bằng nhau và tô màu một phần. Phải chia thành hai phần bằng nhau, không phải hai phần có kích thước bất kỳ.";
  const upload = await page.request.post(base + "/api/content/source-documents/upload", { multipart: { lessonId: lesson._id, file: { name: `analysis-source-${suffix}.txt`, mimeType: "text/plain", buffer: Buffer.from(source) } } });
  assert.equal(upload.status(), 201); const document = await upload.json(); assert.equal(document.processingStatus, "READY");
  await page.goto(`${base}/dashboard/lessons/${lesson._id}`);
  const panel = page.getByTestId("lesson-analysis");
  await expect(panel.getByTestId("analysis-provider")).toContainText(missingKey ? "chưa được cấu hình" : expected === "mock" ? "Mock" : "OpenAI");
  const firstResponse = page.waitForResponse(response => response.url().endsWith(`/api/lessons/${lesson._id}/analyze`) && response.request().method() === "POST", { timeout: 720000 });
  await panel.getByRole("button", { name: "Phân tích bài học", exact: true }).click();
  const first = await firstResponse; const analysis = await first.json();
  if (missingKey) {
    assert.equal(first.status(), 503); assert.equal(analysis.code, "AI_NOT_CONFIGURED");
    await expect(panel.getByRole("alert")).toContainText("OpenAI chưa được cấu hình");
    assert.equal((await api(`/api/lessons/${lesson._id}/analyze`)).length, 0);
  } else {
    assert.equal(first.status(), 201, JSON.stringify(analysis)); assert.equal(analysis.cached, false);
    assert.equal(analysis.provider, expected === "mock" ? "mock-local" : "openai");
    assert.ok(analysis.sourceReferences.includes(document._id));
    await expect(panel.getByTestId("analysis-result")).toContainText(analysis.sourceSummary);
    await expect(panel.getByRole("status")).toContainText("CACHE MISS");
    const cacheResponse = page.waitForResponse(response => response.url().endsWith(`/api/lessons/${lesson._id}/analyze`) && response.request().method() === "POST");
    await panel.getByRole("button", { name: "Regenerate analysis", exact: true }).click();
    const cached = await (await cacheResponse).json(); assert.equal(cached.cached, true); assert.equal(cached._id, analysis._id);
    await expect(panel.getByRole("status")).toContainText("CACHE HIT");
    await page.reload();
    await expect(panel.getByTestId("analysis-result")).toContainText(analysis.sourceSummary);
    assert.equal((await api(`/api/lessons/${lesson._id}/analyze`))[0]._id, analysis._id);
  }
  assert.deepEqual(errors, []);
  const mode = missingKey ? "missing-key" : expected;
  await page.screenshot({ path: `storage/logs/analysis-${mode}.png`, fullPage: true });
  const report = { status: "PASS", mode, lessonId: lesson._id, sourceDocumentId: document._id, analysisId: analysis._id || null, provider: analysis.provider || health.provider, model: analysis.model || health.model, promptVersion: analysis.promptVersion || health.promptVersion, usage: analysis.usage || null, cache: missingKey ? "NOT_RUN" : "MISS/HIT", errorCode: analysis.code || null, testedAt: new Date().toISOString() };
  fs.writeFileSync(`storage/logs/analysis-${mode}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
