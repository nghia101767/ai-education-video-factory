// Read-only review of an existing real OpenAI E2E fixture; no inference.
import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium, expect } from "@playwright/test";
const fixture = JSON.parse(fs.readFileSync("storage/logs/analysis-openai.json", "utf8"));
const base = process.env.E2E_BASE_URL || "http://localhost:3000";
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(base + "/login");
  await page.getByPlaceholder("Email", { exact: true }).fill(process.env.ADMIN_EMAIL);
  await page.getByPlaceholder("Password", { exact: true }).fill(process.env.ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/dashboard**");
  const health = await (await page.request.get(base + "/api/health/analysis")).json();
  assert.equal(health.provider, "openai"); assert.equal(health.runtimeVerified, true);
  const analyses = await (await page.request.get(`${base}/api/lessons/${fixture.lessonId}/analyze`)).json();
  const analysis = analyses.find(item => item._id === fixture.analysisId);
  assert.ok(analysis); assert.equal(analysis.provider, "openai");
  await page.goto(`${base}/dashboard/lessons/${fixture.lessonId}`);
  await expect(page.getByTestId("analysis-result")).toContainText(analysis.sourceSummary);
  await page.reload();
  await expect(page.getByTestId("analysis-result")).toContainText(analysis.sourceSummary);
  await page.goto(base + "/dashboard/help");
  await page.getByRole("button", { name: /6\. Phân tích bài học/ }).click();
  await expect(page.locator(".help-card .help-status")).toHaveText("✨ OpenAI");
  await page.screenshot({ path: "storage/logs/analysis-openai-help.png", fullPage: true });
  const result = { status: "PASS", lessonId: fixture.lessonId, analysisId: fixture.analysisId, health, persistedAfterReload: true, helpBadge: "✨ OpenAI", inferenceCalled: false };
  fs.writeFileSync("storage/logs/analysis-openai-review.json", JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); }
