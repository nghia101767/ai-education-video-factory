// Uses the last additive VieNeu E2E fixture; leaves its valid audio selected.
import assert from "node:assert/strict";
import fs from "node:fs";
const root = process.env.STORAGE_ROOT || "/app/storage";
const fixture = JSON.parse(fs.readFileSync(root + "/logs/vieneu-e2e.json", "utf8"));
const base = process.env.E2E_BASE_URL || "http://web:3000";
const login = await fetch(base + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }) });
assert.equal(login.status, 200);
const cookie = login.headers.get("set-cookie").split(";")[0];
async function api(url, body) {
  const response = await fetch(base + url, { method: body === undefined ? "GET" : "POST", headers: { cookie, "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json(); assert.ok(response.ok, JSON.stringify(data)); return data;
}
async function wait(id, status) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const job = await api("/api/jobs/" + id);
    if (["completed", "failed", "cancelled"].includes(job.status)) { assert.equal(job.status, status, JSON.stringify(job)); return job; }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw Error("Job timeout");
}
const invalid = await api(`/api/scripts/${fixture.scriptId}/audio`, { voice: "invalid-preset-for-test" });
const failed = await wait(invalid.jobId, "failed");
assert.equal(failed.attempts, 1); assert.match(failed.error, /TTS_INVALID/);
const queued = await api(`/api/scripts/${fixture.scriptId}/audio`, { voice: fixture.voice });
const cancelled = await api("/api/jobs/" + queued.jobId, { action: "cancel" }); assert.equal(cancelled.status, "cancelled");
await api("/api/jobs/" + queued.jobId, { action: "retry" });
const retried = await wait(queued.jobId, "completed"); assert.equal(retried.payload.result.cached, true);
const result = { status: "PASS", failedJobId: invalid.jobId, nonRetryableAttempts: failed.attempts, cancelledAndRetriedJobId: queued.jobId, restoredVoice: fixture.voice, cache: "HIT" };
fs.writeFileSync(root + "/logs/vieneu-job-tests.json", JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
