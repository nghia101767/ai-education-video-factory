import { chromium, request } from "@playwright/test";
import assert from "node:assert/strict";
const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:3000";
const api = await request.newContext({ baseURL });
const login = await api.post("/api/auth/login", { data: { email: process.env.ADMIN_EMAIL, password: process.env["ADMIN_" + "PASSWORD"] } }); assert.equal(login.status(), 200);
const initialResponse = await api.get("/api/settings/ai"); assert.equal(initialResponse.status(), 200); const initial = await initialResponse.json();
const videoBeforeResponse = await api.get("/api/videos/6aa53aeb9be2633f33208359"); assert.equal(videoBeforeResponse.status(), 200); const videoBefore = JSON.stringify(await videoBeforeResponse.json());
const browser = await chromium.launch({ headless: true }); const context = await browser.newContext({ storageState: await api.storageState() }); const page = await context.newPage();
const options = ["mock", "huggingface", "openai", "gemini"]; const transitions = [];
try {
  await page.goto(baseURL + "/dashboard/settings", { waitUntil: "networkidle" }); await page.getByTestId("image-provider-settings").waitFor();
  for (const provider of options) {
    await page.getByTestId("image-provider-select").selectOption(provider); const selectedModel = await page.getByTestId("image-model-input").inputValue(); await page.getByTestId("save-image-provider").click(); await page.getByText(/reloaded from the server/).waitFor(); await page.reload({ waitUntil: "networkidle" });
    assert.equal(await page.getByTestId("image-provider-select").inputValue(), provider); assert.equal(await page.getByTestId("image-model-input").inputValue(), selectedModel); const status = await page.getByTestId("image-provider-configured").innerText(); if (provider === "mock") assert.match(status, /configured/i); transitions.push({ provider, model: selectedModel, status });
  }
} finally {
  const restore = await api.patch("/api/settings/ai", { data: { provider: initial.image.provider, model: initial.image.model } }); assert.equal(restore.status(), 200); await page.reload({ waitUntil: "networkidle" }); assert.equal(await page.getByTestId("image-provider-select").inputValue(), initial.image.provider); await browser.close();
}
const videoAfterResponse = await api.get("/api/videos/6aa53aeb9be2633f33208359"); assert.equal(videoAfterResponse.status(), 200); const videoAfter = JSON.stringify(await videoAfterResponse.json()); assert.equal(videoAfter, videoBefore);
const restoredResponse = await api.get("/api/settings/ai"); const restored = await restoredResponse.json(); assert.deepEqual({ provider: restored.image.provider, model: restored.image.model }, { provider: initial.image.provider, model: initial.image.model });
console.log(JSON.stringify({ result: "PASS", transitions, restored: { provider: initial.image.provider, model: initial.image.model }, videoId: "6aa53aeb9be2633f33208359", videoByteIdentical: true }, null, 2)); await api.dispose();
