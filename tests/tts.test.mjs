import test from "node:test";
import assert from "node:assert/strict";
import { ttsConfig } from "../lib/ai/config.ts";
import { createTTSProvider, ttsCacheKey } from "../lib/ai/tts-provider.ts";
import { estimateCost } from "../lib/ai/usage-service.ts";
import { vieneuClient } from "../lib/ai/vieneu-client.ts";

test("local TTS is explicitly selected, zero cost, and does not silently fallback", async () => {
  assert.equal(createTTSProvider("vieneu").name, "vieneu");
  assert.throws(() => createTTSProvider("wrong"), /TTS_CONFIGURATION/);
  assert.equal(estimateCost({ provider: "vieneu", operation: "tts_generation", audioSeconds: 42 }), 0);
  const oldMock = process.env.MOCK_AI, oldProvider = process.env.TTS_PROVIDER;
  try {
    process.env.TTS_PROVIDER = "vieneu"; process.env.MOCK_AI = "false";
    assert.equal(ttsConfig().provider, "vieneu");
    process.env.MOCK_AI = "true"; assert.equal(ttsConfig().provider, "mock");
  } finally {
    if (oldMock === undefined) delete process.env.MOCK_AI; else process.env.MOCK_AI = oldMock;
    if (oldProvider === undefined) delete process.env.TTS_PROVIDER; else process.env.TTS_PROVIDER = oldProvider;
  }
});
test("TTS cache varies with reference content and all synthesis settings", () => {
  const input = { narration: "Xin chào", voice: "default", model: "v3", language: "vi", speed: 1, referenceAudioHash: "a" };
  for (const [key, value] of Object.entries({ narration: "Chào", voice: "other", model: "v4", language: "en", speed: 2, referenceAudioHash: "b" }))
    assert.notEqual(ttsCacheKey("vieneu", input), ttsCacheKey("vieneu", { ...input, [key]: value }));
});
test("invalid inputs fail before network or model access", async () => {
  const provider = createTTSProvider("vieneu");
  const input = { narration: "Xin chào", voice: "default", model: "v3", language: "vi" };
  await assert.rejects(provider.synthesize({ ...input, narration: "" }), /TTS_INVALID_TEXT/);
  await assert.rejects(provider.synthesize({ ...input, referenceAudio: "../private.wav" }), /TTS_INVALID_REFERENCE/);
  await assert.rejects(provider.synthesize({ ...input, speed: 2 }), /TTS_CONFIGURATION/);
});
test("HTTP outage and validation failure retain actionable error classes", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw new Error("connect failed"); };
    await assert.rejects(vieneuClient.request({ operation: "health" }), /TTS_PROCESS_ERROR/);
    globalThis.fetch = async () => Response.json({ code: "TTS_INVALID_INPUT", error: "Unknown preset" }, { status: 422 });
    await assert.rejects(vieneuClient.request({ text: "Xin chào" }), /TTS_INVALID_INPUT/);
  } finally { globalThis.fetch = original; }
});
