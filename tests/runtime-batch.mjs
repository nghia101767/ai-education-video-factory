import assert from "node:assert/strict";
const base = process.env.E2E_BASE_URL || "http://localhost:3000"; let cookie = "";
async function call(path, options = {}) { const headers = new Headers(options.headers || {}); if (cookie) headers.set("cookie", cookie); const response = await fetch(base + path, { ...options, headers }); const body = await response.json(); return { response, body }; }
const login = await call("/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-proto": "https" }, body: JSON.stringify({ email: process.env.E2E_ADMIN_EMAIL || "admin@huunghia.dev", password: process.env.E2E_ADMIN_PASSWORD || "12345678" }) }); assert.equal(login.response.status, 200); cookie = (login.response.headers.get("set-cookie") || "").split(";")[0];
const lessons = await call("/api/content/lessons?search=E2E"); assert.equal(lessons.response.status, 200); assert.ok(lessons.body.items.length >= 3); const selectedLessonIds = lessons.body.items.slice(0, 3).map((lesson) => lesson._id);
const created = await call("/api/batch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lessonIds: selectedLessonIds }) }); assert.equal(created.response.status, 202, JSON.stringify(created.body));
const batchId = created.body.batchId;
const paused = await call(`/api/batch/${batchId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "pause" }) }); assert.equal(paused.body.status, "paused");
await new Promise((resolve) => setTimeout(resolve, 2500));
const duringPause = await call(`/api/batch/${batchId}`); assert.equal(duringPause.body.batch.status, "paused"); assert.ok(duringPause.body.jobs.some((job) => job.status === "queued"));
const resumed = await call(`/api/batch/${batchId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "resume" }) }); assert.equal(resumed.body.status, "running");
const cancelled = await call(`/api/batch/${batchId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "cancel" }) }); assert.equal(cancelled.body.status, "cancelled");
const final = await call(`/api/batch/${batchId}`); assert.ok(final.body.jobs.every((job) => ["completed", "cancelled", "cancellation_requested"].includes(job.status)));
console.log(JSON.stringify({ status: "PASS", batchId, lessonCount: selectedLessonIds.length, pausedQueued: duringPause.body.jobs.filter((job) => job.status === "queued").length, finalStatuses: [...new Set(final.body.jobs.map((job) => job.status))] }, null, 2));
