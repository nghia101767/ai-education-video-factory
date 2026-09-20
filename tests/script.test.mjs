import test from "node:test";
import assert from "node:assert/strict";
import { OpenAILLMProvider } from "../lib/ai/openai-provider.ts";
import { FallbackAIProvider } from "../lib/ai/fallback-provider.ts";
import { scriptSchema } from "../lib/ai/script-schema.ts";
import { contentHash } from "../lib/ai/cache.ts";
import { BudgetExceededError } from "../lib/ai/usage-service.ts";

const analysis = { sourceSummary: "Một phần hai là một trong hai phần bằng nhau.", learningObjectives: ["Nhận biết một phần hai"], keyFacts: ["Hai phần phải bằng nhau"], definitions: ["Một phần hai là một trong hai phần bằng nhau"], formulas: [], examples: ["Chia hình tròn thành hai phần bằng nhau"], commonMistakes: ["Chia hai phần không bằng nhau"], keywords: ["một phần hai"], difficulty: "beginner" };
const input = { title: "Một phần hai", subject: "Toán", grade: "Lớp 2", analysis, style: "engaging", instruction: "Giải thích thật rõ" };
async function validOutput() { return new FallbackAIProvider().generateScript(input); }
function response(value, status = 200) {
  if (status !== 200) return Response.json({ error: { message: "private upstream detail" } }, { status, headers: { "retry-after": "0" } });
  return Response.json({ object: "response", id: "resp_script", model: "gpt-5.6-luna-test-snapshot", status: "completed", output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify(value), annotations: [] }] }], usage: { input_tokens: 150, output_tokens: 100, input_tokens_details: { cached_tokens: 25 } } });
}
async function harness(callback) {
  const saved = { ...process.env }, original = globalThis.fetch;
  Object.assign(process.env, { OPENAI_API_KEY: "test-not-a-real-key", AI_LLM_PROVIDER: "openai", MOCK_AI: "false", OPENAI_SCRIPT_MODEL: "gpt-5.6-luna", AI_RETRY_LIMIT: "2", AI_RETRY_BASE_MS: "0" });
  try { await callback(); } finally { globalThis.fetch = original; for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key]; Object.assign(process.env, saved); }
}

test("script v2 schema enforces Vietnamese, 25-35 seconds and scene consistency", async () => {
  const value = await validOutput(); assert.equal(scriptSchema.safeParse(value).success, true);
  for (const changed of [
    { ...value, estimatedDuration: 24 },
    { ...value, targetDuration: 29 },
    { ...value, narration: "English words only for this narration and therefore it is not acceptable as Vietnamese educational speech." },
    { ...value, scenes: value.scenes.map((scene, i) => i ? scene : { ...scene, duration: scene.duration + 2 }) },
    { ...value, scenes: value.scenes.map((scene, i) => i ? scene : { ...scene, order: 2 }) },
  ]) assert.equal(scriptSchema.safeParse(changed).success, false);
});

test("script Responses API uses strict Structured Outputs and records real response usage", () => harness(async () => {
  const value = await validOutput(); let request; const attempts = [];
  globalThis.fetch = async (_url, init) => { request = JSON.parse(init.body); return response(value); };
  const provider = new OpenAILLMProvider(); const output = await provider.generateScript(input, { onAttempt: async attempt => attempts.push(attempt) });
  assert.equal(scriptSchema.safeParse(output).success, true); assert.equal(request.text.format.type, "json_schema"); assert.equal(request.text.format.strict, true); assert.equal(request.store, false);
  assert.equal(attempts.length, 1); assert.equal(attempts[0].model, "gpt-5.6-luna-test-snapshot"); assert.equal(attempts[0].inputTokens, 150); assert.equal(attempts[0].outputTokens, 100); assert.equal(attempts[0].cachedInputTokens, 25);
}));

test("script invalid output and temporary provider failures retry boundedly; auth does not", () => harness(async () => {
  let calls = 0; globalThis.fetch = async () => { calls++; return response({ wrong: true }); };
  await assert.rejects(new OpenAILLMProvider().generateScript(input), error => error.code === "AI_INVALID_OUTPUT"); assert.equal(calls, 3);
  for (const status of [429, 500, 401]) { calls = 0; globalThis.fetch = async () => { calls++; return response({}, status); }; await assert.rejects(new OpenAILLMProvider().generateScript(input)); assert.equal(calls, status === 401 ? 1 : 3); }
}));

test("script missing key and budget guard never call OpenAI", () => harness(async () => {
  let calls = 0; globalThis.fetch = async () => { calls++; return response(await validOutput()); };
  delete process.env.OPENAI_API_KEY; await assert.rejects(new OpenAILLMProvider().generateScript(input), error => error.code === "AI_NOT_CONFIGURED");
  process.env.OPENAI_API_KEY = "test-not-a-real-key"; await assert.rejects(new OpenAILLMProvider().generateScript(input, { beforeAttempt: async () => { throw new BudgetExceededError("blocked"); } }), /blocked/);
  assert.equal(calls, 0);
}));

test("script cache identity separates analysis, target, style and instruction", () => {
  const base = { provider: "openai", model: "gpt-5.6-luna", promptVersion: "script-generation-v2", schemaVersion: "script-schema-v2", analysisHash: "a", targetDuration: 30, style: "engaging", instruction: "" };
  const key = contentHash(base);
  for (const changed of [{ ...base, analysisHash: "b" }, { ...base, targetDuration: 29 }, { ...base, style: "clear" }, { ...base, instruction: "ngắn hơn" }]) assert.notEqual(contentHash(changed), key);
});
