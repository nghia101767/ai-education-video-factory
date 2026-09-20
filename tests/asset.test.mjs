import test from "node:test";
import assert from "node:assert/strict";
import { imageDimensions, normalizeTags, scoreAsset, validateVisualUpload, visualAssetTypes } from "../lib/asset-management.ts";
import { classifyImageProviderError, imageCacheKey, ImageProviderError, MockImageProvider, OpenAIImageProvider, createImageProvider, imageProviderStatus, validateGeneratedRaster } from "../lib/ai/image-provider.ts";
import { validateAssetUpload } from "../lib/upload-validation.ts";
import { StorageService } from "../lib/storage.ts";
import sharp from "sharp";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");

test("Step 10 schema types and image upload validation enforce extension, exact MIME/signature, integrity, dimensions, size, and traversal", () => {
  assert.deepEqual(visualAssetTypes, ["character","background","object","icon","illustration","diagram","image"]); assert.deepEqual(imageDimensions("image/png", png), { width: 1, height: 1 }); assert.deepEqual(validateVisualUpload("real.png", "image/png", png, "illustration"), { width: 1, height: 1 });
  assert.throws(() => validateVisualUpload("../real.png", "image/png", png, "image"), /filename/); assert.throws(() => validateVisualUpload("real.jpg", "image/png", png, "image"), /extension/); assert.throws(() => validateVisualUpload("real.png", "image/jpeg", png, "image"), /extension|content/); assert.throws(() => validateVisualUpload("real.png", "image/png", png.subarray(0, 24), "image"), /content|dimensions/); assert.throws(() => validateVisualUpload("real.png", "image/png", png, "image", 1), /between/); assert.throws(() => validateAssetUpload("fake.jpg", "image/jpeg", png, "image"), /content/);
});

test("ranked reuse matching is deterministic across type, tags, description, role, style, aspect and character identity", () => {
  const requirement = { type: "character", tags: ["fraction", "teacher"], description: "Cô giáo giải thích phân số", role: "subject", style: "watercolor", aspectRatio: "9:16", characterIdentity: "Co Lan" };
  const strong = { type: "character", tags: ["teacher", "fraction"], name: "Cô giáo phân số", description: "giải thích", role: "subject", style: "watercolor", aspectRatio: "9:16", characterIdentity: "Cô Lan" };
  const weak = { type: "image", tags: [], description: "phong cảnh", role: "background" }; assert.ok(scoreAsset(strong, requirement) > scoreAsset(weak, requirement)); assert.equal(scoreAsset({ type: "audio" }, requirement), -1); assert.deepEqual(normalizeTags(" A, a, B "), ["a", "b"]);
});

test("image cache identity separates provider, model, prompt, type, style, dimensions and settings", () => {
  const request = { prompt: "fraction", type: "diagram", style: "paper", dimensions: { width: 1024, height: 1536 }, settings: { quality: "high" } }; const key = imageCacheKey("mock-local", "m1", request); for (const changed of [["openai", "m1", request], ["mock-local", "m2", request], ["mock-local", "m1", { ...request, prompt: "other" }], ["mock-local", "m1", { ...request, type: "icon" }], ["mock-local", "m1", { ...request, style: "3d" }], ["mock-local", "m1", { ...request, dimensions: { width: 512, height: 512 } }], ["mock-local", "m1", { ...request, settings: { quality: "low" } }]]) assert.notEqual(imageCacheKey(...changed), key);
});

test("provider selection keeps Mock, reports real unavailable honestly, and never silently falls back", async () => {
  const oldProvider = process.env.AI_IMAGE_PROVIDER, oldMock = process.env.MOCK_AI, oldKey = process.env.OPENAI_API_KEY; try { process.env.MOCK_AI = "false"; process.env.AI_IMAGE_PROVIDER = "openai"; delete process.env.OPENAI_API_KEY; assert.equal(imageProviderStatus().mode, "not_configured"); await assert.rejects(new OpenAIImageProvider().generateImage({ prompt: "x" }), error => error instanceof ImageProviderError && error.code === "CONFIGURATION_ERROR"); assert.ok(createImageProvider("mock") instanceof MockImageProvider); assert.throws(() => createImageProvider("unknown"), /INVALID_IMAGE_PROVIDER/); } finally { if (oldProvider === undefined) delete process.env.AI_IMAGE_PROVIDER; else process.env.AI_IMAGE_PROVIDER = oldProvider; if (oldMock === undefined) delete process.env.MOCK_AI; else process.env.MOCK_AI = oldMock; if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey; }
});

test("real PNG, JPEG and WEBP bytes report their actual dimensions", async () => {
  const fixtures = await Promise.all([
    sharp({ create: { width: 17, height: 23, channels: 3, background: "red" } }).png().toBuffer(),
    sharp({ create: { width: 29, height: 31, channels: 3, background: "blue" } }).jpeg().toBuffer(),
    sharp({ create: { width: 37, height: 41, channels: 3, background: "green" } }).webp().toBuffer(),
  ]);
  assert.deepEqual(imageDimensions("image/png", fixtures[0]), { width: 17, height: 23 });
  assert.deepEqual(imageDimensions("image/jpeg", fixtures[1]), { width: 29, height: 31 });
  assert.deepEqual(imageDimensions("image/webp", fixtures[2]), { width: 37, height: 41 });
  assert.deepEqual(validateVisualUpload("fixture.webp", "image/webp", fixtures[2], "background"), { width: 37, height: 41 });
});

test("storage confines reads, writes and deletes to the selected storage folder", async () => {
  const service = new StorageService(`/tmp/step10-storage-${process.pid}`);
  await service.save("images", "nested/good.png", png);
  assert.deepEqual(await service.read("images", "nested/good.png"), png);
  for (const bad of ["../outside", "/tmp/outside", "nested/../../outside", "bad\0name"]) {
    assert.throws(() => service.getPath("images", bad), /Invalid storage path/);
  }
  await service.delete("images", "nested/good.png");
  assert.equal(await service.exists("images", "nested/good.png"), false);
});

const providerHarness = async fn => {
  const saved = { ...process.env };
  Object.assign(process.env, { OPENAI_API_KEY: "test-key", AI_IMAGE_PROVIDER: "openai", OPENAI_IMAGE_MODEL: "gpt-image-1", MOCK_AI: "false", AI_RETRY_BASE_MS: "100", AI_IMAGE_MAX_ATTEMPTS: "3" });
  try { await fn(); } finally { for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key]; Object.assign(process.env, saved); }
};
const apiError = ({ status = 429, code, type, message = "provider detail", retryAfter, requestId = "req-safe" }) => ({ status, code, type, message, request_id: requestId, headers: new Headers({ ...(retryAfter === undefined ? {} : { "retry-after": String(retryAfter) }), "x-request-id": requestId }) });

test("OpenAI image 429 classification distinguishes credit/quota, spend limits, and transient rate limits without leaking provider text", () => {
  const variants = [
    [apiError({ code: "credit_balance_exhausted", type: "insufficient_quota", message: "no credits" }), "QUOTA_EXCEEDED", false],
    [apiError({ code: "insufficient_quota", type: "insufficient_quota", message: "quota" }), "QUOTA_EXCEEDED", false],
    [apiError({ code: "organization_usage_limit_exceeded", message: "organization usage limit reached" }), "QUOTA_EXCEEDED", false],
    [apiError({ code: "organization_spend_limit_exceeded", message: "organization spend limit reached" }), "QUOTA_EXCEEDED", false],
    [apiError({ code: "project_spend_limit_exceeded", message: "project spend limit reached" }), "QUOTA_EXCEEDED", false],
    [apiError({ code: "rate_limit_exceeded", message: "secret provider diagnostic", retryAfter: 2 }), "RATE_LIMITED", true],
  ];
  for (const [input, code, retryable] of variants) { const error = classifyImageProviderError(input); assert.equal(error.code, code); assert.equal(error.retryable, retryable); assert.equal(error.requestId, "req-safe"); assert.doesNotMatch(error.message, /secret provider diagnostic/); }
  assert.equal(classifyImageProviderError(apiError({ status: 401 })).code, "AUTHENTICATION_ERROR");
  assert.equal(classifyImageProviderError(apiError({ status: 400 })).code, "INVALID_REQUEST");
  assert.equal(classifyImageProviderError(apiError({ status: 500 })).code, "PROVIDER_ERROR");
  assert.equal(classifyImageProviderError(new Error("network connection failed")).code, "NETWORK_ERROR");
});

test("transient image rate limit uses max-three attempts, honors Retry-After, and otherwise applies exponential jitter with SDK retry disabled", () => providerHarness(async () => {
  let calls = 0; const sleeps = [];
  const provider = new OpenAIImageProvider({ transport: async () => { calls++; throw apiError({ code: "rate_limit_exceeded", retryAfter: calls === 1 ? 2 : undefined }); }, sleep: async value => sleeps.push(value), random: () => 0 });
  await assert.rejects(provider.generateImage({ prompt: "x" }), error => error instanceof ImageProviderError && error.code === "RATE_LIMITED");
  assert.equal(calls, 3); assert.deepEqual(sleeps, [2000, 100]);
}));

test("quota, spend, authentication, invalid request, and unknown failures never retry or fall back to Mock", () => providerHarness(async () => {
  for (const failure of [apiError({ code: "credit_balance_exhausted", type: "insufficient_quota" }), apiError({ code: "usage_limit_reached", message: "spend limit" }), apiError({ status: 401 }), apiError({ status: 400 }), new Error("unclassified")]) {
    let calls = 0, saves = 0;
    const provider = new OpenAIImageProvider({ transport: async () => { calls++; throw failure; }, imageStorage: { save: async () => { saves++; } }, sleep: async () => assert.fail("non-retryable failure slept") });
    await assert.rejects(provider.generateImage({ prompt: "x" })); assert.equal(calls, 1); assert.equal(saves, 0); assert.equal(provider.name, "openai");
  }
}));

test("valid OpenAI PNG response is integrity-checked with real dimensions before service storage", () => providerHarness(async () => {
  const bytes = await sharp({ create: { width: 17, height: 23, channels: 3, background: "red" } }).png().toBuffer(); const saved = [];
  const provider = new OpenAIImageProvider({ transport: async () => ({ encoded: bytes.toString("base64"), requestId: "req-valid" }), imageStorage: { save: async (...args) => { saved.push(args); return "ok"; } } });
  const result = await provider.generateImage({ prompt: "valid-image/png" });
  assert.equal(result.mimeType, "image/png"); assert.equal(result.width, 17); assert.equal(result.height, 23); assert.equal(result.size, bytes.length); assert.deepEqual(result.data, bytes); assert.equal(result.requestId, "req-valid"); assert.equal(saved.length, 0);
}));

test("invalid, truncated, unsupported, empty, and oversized image responses never write storage", () => providerHarness(async () => {
  const corrupt = Buffer.concat([png.subarray(0, 24), Buffer.from("not-an-image")]);
  for (const bytes of [Buffer.alloc(0), Buffer.from("not image"), corrupt]) {
    let saves = 0;
    const provider = new OpenAIImageProvider({ transport: async () => ({ encoded: bytes.toString("base64") }), imageStorage: { save: async () => { saves++; } } });
    await assert.rejects(provider.generateImage({ prompt: "invalid" }), error => error instanceof ImageProviderError && error.code === "INVALID_IMAGE"); assert.equal(saves, 0);
  }
  const old = process.env.MAX_IMAGE_ASSET_SIZE; process.env.MAX_IMAGE_ASSET_SIZE = "1";
  try { await assert.rejects(validateGeneratedRaster(png), error => error.code === "INVALID_IMAGE"); } finally { if (old === undefined) delete process.env.MAX_IMAGE_ASSET_SIZE; else process.env.MAX_IMAGE_ASSET_SIZE = old; }
}));
