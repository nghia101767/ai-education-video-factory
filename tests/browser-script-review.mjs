// Read-only post-restart Step 7 persistence/UI review; never calls an AI endpoint.
import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium, expect } from "@playwright/test";
const fixture = JSON.parse(fs.readFileSync("storage/logs/script-openai.json", "utf8")); const base = process.env.E2E_BASE_URL || "http://localhost:3000";
const browser = await chromium.launch();
try {
  const page = await browser.newPage(); const errors = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto(base + "/login"); await page.getByPlaceholder("Email", { exact: true }).fill(process.env.ADMIN_EMAIL); await page.getByPlaceholder("Password", { exact: true }).fill(process.env.ADMIN_PASSWORD); await page.getByRole("button", { name: "Sign in", exact: true }).click(); await page.waitForURL("**/dashboard**");
  const health = await (await page.request.get(base + "/api/health/script")).json(); assert.equal(health.provider, "openai"); assert.equal(health.runtimeVerified, true);
  const initial = await (await page.request.get(`${base}/api/scripts/${fixture.initialScriptId}`)).json(); const regenerated = await (await page.request.get(`${base}/api/scripts/${fixture.regeneratedScriptId}`)).json(); assert.equal(initial._id, fixture.initialScriptId); assert.equal(regenerated._id, fixture.regeneratedScriptId);
  await page.goto(`${base}/dashboard/lessons/${fixture.lessonId}`); await expect(page.getByTestId("script-provider")).toContainText("OpenAI đã chạy thực tế"); await expect(page.locator(`[data-script-id="${fixture.initialScriptId}"]`)).toBeVisible(); await expect(page.locator(`[data-script-id="${fixture.regeneratedScriptId}"]`)).toContainText("script-schema-v2"); assert.deepEqual(errors, []);
  const report = { status: "PASS", checkedAt: new Date().toISOString(), inferenceCalled: false, persistedAfterContainerRestart: true, initialScriptId: initial._id, regeneratedScriptId: regenerated._id, health, uiProviderBadge: "OpenAI đã chạy thực tế", pageErrors: errors }; fs.writeFileSync("storage/logs/script-openai-restart.json", JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
