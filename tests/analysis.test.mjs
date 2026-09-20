import test from "node:test";
import assert from "node:assert/strict";
import { requestAnalysis, AnalysisError } from "../lib/ai/analysis-response.ts";
import { lessonAnalysisSchema } from "../lib/ai/analysis-schema.ts";
import { normalizeLessonText, validateAnalysisSize } from "../lib/ai/analysis-input.ts";
import { calculateCost } from "../lib/ai/pricing.ts";
import { BudgetExceededError } from "../lib/ai/usage-service.ts";

const output = { sourceSummary: "Một phần hai là một trong hai phần bằng nhau.", learningObjectives: ["Nhận biết một phần hai"], keyFacts: ["Hai phần bằng nhau"], definitions: [], formulas: [], examples: [], commonMistakes: [], keywords: ["phân số"], difficulty: "beginner" };
function response(value = output) {
  return Response.json({ object: "response", id: "resp_test", model: "gpt-5.6-luna-test-snapshot", status: "completed", output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify(value), annotations: [] }] }], usage: { input_tokens: 100, output_tokens: 50, input_tokens_details: { cached_tokens: 20 } } });
}
async function harness(callback) {
  const saved = { ...process.env }, original = globalThis.fetch;
  Object.assign(process.env, { OPENAI_API_KEY: "test-not-a-real-key", AI_LLM_PROVIDER: "openai", MOCK_AI: "false", AI_RETRY_LIMIT: "2", AI_RETRY_BASE_MS: "0" });
  try { await callback(); } finally { globalThis.fetch = original; for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key]; Object.assign(process.env, saved); }
}
test("analysis normalizes page headers without truncation and rejects oversized input", () => {
  assert.equal(normalizeLessonText("Bài 1\n  Câu  một.\fBài 1\nCâu hai."), "Bài 1\nCâu một.\n\nCâu hai.");
  assert.ok(validateAnalysisSize({ title: "Phân số", summary: "Một phần hai." }) > 0);
  assert.throws(() => validateAnalysisSize({ title: "Long", summary: "a".repeat(250001) }), /quá dài/);
});
test("analysis schema rejects missing, extra, empty and incorrectly typed fields", () => {
  assert.equal(lessonAnalysisSchema.safeParse(output).success, true);
  for (const value of [{}, { ...output, extra: true }, { ...output, sourceSummary: " " }, { ...output, keyFacts: [123] }]) assert.equal(lessonAnalysisSchema.safeParse(value).success, false);
});
test("official SDK sends strict Responses schema and records actual usage/model", () => harness(async () => {
  let request; const attempts = [];
  globalThis.fetch = async (_url, init) => { request = JSON.parse(init.body); return response(); };
  const value = await requestAnalysis({ title: "Phân số", summary: "Nguồn thật" }, { onAttempt: async event => { attempts.push(event); } });
  assert.deepEqual(value, output); assert.equal(request.text.format.type, "json_schema"); assert.equal(request.text.format.strict, true);
  assert.equal(request.text.format.schema.additionalProperties, false); assert.equal(request.store, false);
  assert.equal(attempts[0].inputTokens, 100); assert.equal(attempts[0].cachedInputTokens, 20); assert.equal(attempts[0].model, "gpt-5.6-luna-test-snapshot");
}));
test("invalid output retries boundedly and records failed paid responses", () => harness(async () => {
  let calls = 0; const attempts = [];
  globalThis.fetch = async () => { calls++; return response({ wrong: true }); };
  await assert.rejects(requestAnalysis({ title: "Phân số" }, { onAttempt: async event => { attempts.push(event); } }), error => error.code === "AI_INVALID_OUTPUT");
  assert.equal(calls, 3); assert.equal(attempts.length, 3); assert.ok(attempts.every(a => a.status === "failed" && a.inputTokens === 100));
}));
test("429 and 5xx retry; 400/401, quota, refusal and long Retry-After do not loop", () => harness(async () => {
  for (const status of [429, 500, 400, 401]) {
    let calls = 0;
    globalThis.fetch = async () => { calls++; return Response.json({ error: { message: "private upstream details" } }, { status, headers: { "retry-after": "0" } }); };
    await assert.rejects(requestAnalysis({ title: "Test" }), error => error instanceof AnalysisError && !error.message.includes("private upstream"));
    assert.equal(calls, [429, 500].includes(status) ? 3 : 1);
  }
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ error: { code: "insufficient_quota" } }, { status: 429 }); };
  await assert.rejects(requestAnalysis({ title: "Test" }), error => error.code === "AI_QUOTA_EXCEEDED"); assert.equal(calls, 1);
  calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ error: {} }, { status: 429, headers: { "retry-after": "120" } }); };
  await assert.rejects(requestAnalysis({ title: "Test" })); assert.equal(calls, 1);
  calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ object: "response", id: "refusal-test", model: "test", status: "completed", output: [{ type: "message", content: [{ type: "refusal", refusal: "No" }] }] }); };
  await assert.rejects(requestAnalysis({ title: "Test" }), error => error.code === "AI_REFUSAL"); assert.equal(calls, 1);
}));
test("connection errors and timeout are bounded and sanitized", () => harness(async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new TypeError("network private detail"); };
  await assert.rejects(requestAnalysis({ title: "Test" }), error => error.code === "AI_NETWORK_ERROR"); assert.equal(calls, 3);
  process.env.AI_TIMEOUT_MS = "10"; calls = 0;
  globalThis.fetch = async (_url, init) => { calls++; return new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true })); };
  await assert.rejects(requestAnalysis({ title: "Test" }), error => error.code === "AI_TIMEOUT"); assert.equal(calls, 3);
}));
test("missing key and budget block never call OpenAI", () => harness(async () => {
  let calls = 0; globalThis.fetch = async () => { calls++; return response(); };
  delete process.env.OPENAI_API_KEY;
  await assert.rejects(requestAnalysis({ title: "Test" }), error => error.code === "AI_NOT_CONFIGURED");
  process.env.OPENAI_API_KEY = "test-not-a-real-key";
  await assert.rejects(requestAnalysis({ title: "Test" }, { beforeAttempt: async () => { throw new BudgetExceededError("Budget blocked"); } }), /Budget blocked/);
  assert.equal(calls, 0);
}));
test("analysis pricing uses configured cached-token rate and never invents it", () => harness(async () => {
  process.env.AI_PRICING_JSON = JSON.stringify({ rules: { "openai:test": { inputPerMillionTokens: 1, outputPerMillionTokens: 2, cachedInputPerMillionTokens: 0.5 } } });
  assert.equal(calculateCost("openai", "lesson_analysis", "test", { inputTokens: 100, cachedInputTokens: 20, outputTokens: 50 }), 0.00019);
  process.env.AI_PRICING_JSON = JSON.stringify({ rules: { "openai:test": { inputPerMillionTokens: 1 } } });
  assert.equal(calculateCost("openai", "lesson_analysis", "test", { inputTokens: 100, cachedInputTokens: 20 }), null);
}));
