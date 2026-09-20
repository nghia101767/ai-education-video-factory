import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const cache = await import("../lib/ai/cache.ts");
const schemas = await import("../lib/ai/schemas.ts");
const pricing = await import("../lib/ai/pricing.ts");
const config = await import("../lib/ai/config.ts");
const { StorageService } = await import("../lib/storage.ts");
const { validateUploadContent, validateAssetUpload } = await import("../lib/upload-validation.ts");
const { sessionCookie } = await import("../lib/auth.ts");
const authRequest = await import("../lib/auth-request.ts");
const { FallbackAIProvider } = await import("../lib/ai/fallback-provider.ts");
const { processDocument } = await import("../lib/document-processing.ts");

const validScript = { title: "Phân số", hook: "Bạn biết chưa?", narration: "Phân số biểu diễn các phần bằng nhau của một tổng thể.", targetAudience: "Lớp 4", educationalGoal: "Hiểu phân số", callToAction: "Hãy thử một ví dụ!" };

test("cache key preserves nested content and separates model/provider/prompt/settings", () => {
  const base = { provider: "openai", model: "sol-model", promptVersion: "v2", content: { title: "A", facts: ["one"] }, settings: { temperature: 0.2 } };
  assert.equal(cache.contentHash(base), cache.contentHash({ settings: { temperature: 0.2 }, content: { facts: ["one"], title: "A" }, promptVersion: "v2", model: "sol-model", provider: "openai" }));
  assert.notEqual(cache.contentHash(base), cache.contentHash({ ...base, model: "luna-model" }));
  assert.notEqual(cache.contentHash(base), cache.contentHash({ ...base, provider: "other" }));
  assert.notEqual(cache.contentHash(base), cache.contentHash({ ...base, content: { title: "B", facts: ["one"] } }));
  assert.notEqual(cache.contentHash(base), cache.contentHash({ ...base, settings: { temperature: 0.8 } }));
});

test("structured output rejects missing, wrong, extra, empty and malformed values", () => {
  assert.equal(schemas.validScript(validScript), true);
  for (const value of [{ ...validScript, hook: undefined }, { ...validScript, narration: 42 }, { ...validScript, extra: true }, { ...validScript, title: "" }]) assert.equal(schemas.validScript(value), false);
  for (const value of ["", "{", JSON.stringify({ ...validScript, extra: true })]) assert.throws(() => schemas.parseStructured(value, schemas.validScript), /AI output/);
  const analysis = { sourceSummary: "Tóm tắt", learningObjectives: ["Hiểu"], keyFacts: ["Đúng"], definitions: [], formulas: [], examples: [], commonMistakes: [], keywords: ["toán"], difficulty: "beginner" };
  assert.equal(schemas.validAnalysis(analysis), true);
  assert.equal(schemas.validAnalysis({ ...analysis, keyFacts: [123] }), false);
  assert.equal(schemas.validAnalysis({ ...analysis, difficulty: "impossible" }), false);
});

test("script duration outside 25-35 seconds is a validation failure", async () => {
  const validator = await import("../lib/ai/validator.ts");
  assert.equal(validator.validateScript({ hook: "Hook", narration: "quá ngắn", callToAction: "CTA" }).valid, false);
});

test("malformed provider output is retried then succeeds; exhausted retries fail cleanly", async () => {
  const previous = { key: process.env.OPENAI_API_KEY, retries: process.env.AI_RETRY_LIMIT, delay: process.env.AI_RETRY_BASE_MS };
  process.env.OPENAI_API_KEY = "test-only"; process.env.AI_RETRY_LIMIT = "1"; process.env.AI_RETRY_BASE_MS = "0";
  const originalFetch = globalThis.fetch; const { requestStructured } = await import("../lib/ai/openai-provider.ts"); let calls = 0;
  globalThis.fetch = async () => { calls += 1; return new Response(JSON.stringify({ choices: [{ message: { content: calls === 1 ? "{" : JSON.stringify(validScript) } }] }), { status: 200, headers: { "Content-Type": "application/json" } }); };
  try { assert.deepEqual(await requestStructured("prompt", "schema", schemas.validScript, {}), validScript); assert.equal(calls, 2); globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: "" } }] }), { status: 200 }); await assert.rejects(() => requestStructured("prompt", "schema", schemas.validScript, {}), /empty/); }
  finally { globalThis.fetch = originalFetch; for (const [key, value] of Object.entries(previous)) { const envKey = key === "key" ? "OPENAI_API_KEY" : key === "retries" ? "AI_RETRY_LIMIT" : "AI_RETRY_BASE_MS"; if (value === undefined) delete process.env[envKey]; else process.env[envKey] = value; } }
});

test("pricing requires provider and model; cache hits cost zero", async () => {
  const previous = process.env.AI_PRICING_JSON;
  process.env.AI_PRICING_JSON = JSON.stringify({ version: "test", currency: "USD", rules: { "openai:sol-model:lesson_analysis": { inputPerMillionTokens: 2, outputPerMillionTokens: 4 } } });
  try {
    assert.equal(pricing.calculateCost("openai", "lesson_analysis", "sol-model", { inputTokens: 1_000_000, outputTokens: 500_000 }), 4);
    assert.equal(pricing.calculateCost("other", "lesson_analysis", "sol-model", { inputTokens: 1_000_000 }), null);
    assert.equal(pricing.calculateCost("openai", "lesson_analysis", "unknown", { inputTokens: 1_000_000 }), null);
    const usage = await import("../lib/ai/usage-service.ts");
    assert.equal(usage.estimateCost({ provider: "openai", model: "sol-model", operation: "lesson_analysis", cached: true, inputTokens: 99 }), 0);
    assert.equal(usage.estimateCost({ provider: "mock-local", model: "mock", operation: "lesson_analysis" }), 0);
  } finally { if (previous === undefined) delete process.env.AI_PRICING_JSON; else process.env.AI_PRICING_JSON = previous; }
});

test("daily and monthly budget guards block before a provider action", async () => {
  const usage = await import("../lib/ai/usage-service.ts"); let providerCalls = 0;
  const guarded = async (daily, monthly, dayTotal, monthTotal) => { usage.assertBudgetAvailable(daily, monthly, dayTotal, monthTotal); providerCalls += 1; };
  await guarded(10, 100, 9, 99); assert.equal(providerCalls, 1);
  await assert.rejects(() => guarded(10, 100, 10, 99), (error) => error.code === "blocked_budget"); assert.equal(providerCalls, 1);
  await assert.rejects(() => guarded(10, 100, 9, 100), (error) => error.code === "blocked_budget"); assert.equal(providerCalls, 1);
});

test("MOCK_AI overrides every provider selection", () => {
  const previous = process.env.MOCK_AI; process.env.MOCK_AI = "true";
  try { assert.equal(config.llmConfig().provider, "mock"); assert.equal(config.imageConfig().provider, "mock"); assert.equal(config.ttsConfig().provider, "mock"); }
  finally { if (previous === undefined) delete process.env.MOCK_AI; else process.env.MOCK_AI = previous; }
});

test("image and TTS caches separate model, voice, style, character and provider", async () => {
  const images = await import("../lib/ai/image-provider.ts"); const tts = await import("../lib/ai/tts-provider.ts");
  const image = { prompt: "classroom", style: "cartoon", character: "Minh", aspectRatio: "9:16" };
  assert.equal(images.imageCacheKey("openai-image", "sol-image", image), images.imageCacheKey("openai-image", "sol-image", image));
  assert.notEqual(images.imageCacheKey("openai-image", "sol-image", image), images.imageCacheKey("openai-image", "other-image", image));
  assert.notEqual(images.imageCacheKey("openai-image", "sol-image", image), images.imageCacheKey("openai-image", "sol-image", { ...image, style: "whiteboard" }));
  const speech = { narration: "Xin chào", voice: "alloy", model: "sol-tts", language: "vi" };
  assert.notEqual(tts.ttsCacheKey("openai-tts", speech), tts.ttsCacheKey("openai-tts", { ...speech, voice: "nova" }));
  assert.notEqual(tts.ttsCacheKey("openai-tts", speech), tts.ttsCacheKey("openai-tts", { ...speech, model: "other-tts" }));
});

test("storage rejects traversal and stays inside its folder", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "aivf-storage-")); const service = new StorageService(root);
  assert.throws(() => service.getPath("documents", "../secret.txt"), /Invalid storage path/);
  assert.throws(() => service.getPath("documents", "/etc/passwd"), /Invalid storage path/);
  await service.save("documents", "safe/file.txt", "ok");
  assert.equal((await service.read("documents", "safe/file.txt")).toString(), "ok");
});

test("upload validation detects MIME spoofing", () => {
  validateUploadContent("note.txt", "text/plain", Buffer.from("Tiếng Việt hợp lệ", "utf8"));
  assert.throws(() => validateUploadContent("attack.png", "image/png", Buffer.from("not a png")), /content/);
  assert.throws(() => validateUploadContent("attack.exe", "image/png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), /extension/);
});

test("asset upload validation rejects extension, MIME, and signature spoofing", () => {
  const wav = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(8)]);
  validateAssetUpload("voice.wav", "audio/wav", wav, "audio");
  assert.throws(() => validateAssetUpload("voice.mp3", "audio/mpeg", Buffer.from("not audio"), "audio"), /content/);
  assert.throws(() => validateAssetUpload("movie.exe", "video/mp4", Buffer.alloc(12), "video"), /extension/);
  assert.throws(() => validateAssetUpload("photo.png", "audio/wav", wav, "image"), /MIME/);
});

test("document processor imports safely and extracts UTF-8 without package demo side effects", async () => {
  const result = await processDocument(Buffer.from("Bài học tiếng Việt\nPhân số", "utf8"), "text/plain");
  assert.equal(result.processingStatus, "READY");
  assert.equal(result.extractedText, "Bài học tiếng Việt\nPhân số");
  assert.equal(result.hash.length, 64);
  const image = await processDocument(Buffer.from([0x89, 0x50, 0x4e, 0x47]), "image/png");
  assert.equal(image.processingStatus, "OCR_NOT_CONFIGURED");
  const empty = await processDocument(Buffer.alloc(0), "text/plain");
  assert.equal(empty.processingStatus, "FAILED");
});

test("document processor extracts real PDF and DOCX content", async () => {
  const pdf = await readFile(new URL("../node_modules/pdf-parse/test/data/01-valid.pdf", import.meta.url));
  const pdfResult = await processDocument(pdf, "application/pdf");
  assert.equal(pdfResult.processingStatus, "READY"); assert.ok(pdfResult.extractedText.length > 10); assert.ok(pdfResult.metadata.pages >= 1);
  const JSZip = (await import("jszip")).default; const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.folder("_rels").file(".rels", `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.folder("word").file("document.xml", `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Bài học DOCX tiếng Việt</w:t></w:r></w:p></w:body></w:document>`);
  const docxResult = await processDocument(await zip.generateAsync({ type: "nodebuffer" }), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  assert.equal(docxResult.processingStatus, "READY"); assert.match(docxResult.extractedText, /DOCX tiếng Việt/);
});

test("mock OCR is explicit and never looks like real OCR", async () => {
  const previous = process.env.MOCK_AI; process.env.MOCK_AI = "true";
  try { const image = await processDocument(Buffer.from([0x89, 0x50, 0x4e, 0x47]), "image/png"); assert.equal(image.processingStatus, "READY"); assert.equal(image.metadata.mock, true); assert.match(image.extractedText, /^\[MOCK OCR\]/); }
  finally { if (previous === undefined) delete process.env.MOCK_AI; else process.env.MOCK_AI = previous; }
});

test("render path accepts only absolute paths inside storage", async () => {
  const { resolveStoragePath } = await import("../lib/render-engine.ts"); const inside = path.resolve("storage/videos/test.mp4");
  assert.equal(resolveStoragePath(inside), inside); assert.throws(() => resolveStoragePath("/tmp/outside.mp4"), /Invalid render asset path/);
});

test("session cookie is HttpOnly/SameSite and Secure only on HTTPS", () => {
  const previous = process.env.APP_URL;
  process.env.APP_URL = "http://web.example"; const http = sessionCookie("token", new Date(Date.now() + 60_000));
  process.env.APP_URL = "https://web.example"; const https = sessionCookie("token", new Date(Date.now() + 60_000));
  assert.match(http, /HttpOnly/); assert.match(http, /SameSite=Lax/); assert.doesNotMatch(http, / Secure;/); assert.match(https, / Secure;/);
  if (previous === undefined) delete process.env.APP_URL; else process.env.APP_URL = previous;
});

test("HTTPS proxy login validates sessions internally and honors only safe next paths", () => {
  assert.equal(authRequest.sessionValidationUrl("https://web.example/dashboard", "http://web:3000").href, "http://web:3000/api/auth/session");
  assert.equal(authRequest.requestUsesHttps(new Request("http://web:3000/api/auth/login", { headers: { "x-forwarded-proto": "https" } })), true);
  assert.equal(authRequest.safeLoginDestination("/dashboard/videos/1"), "/dashboard/videos/1");
  assert.equal(authRequest.safeLoginDestination("//evil.example"), "/dashboard");
  assert.equal(authRequest.safeLoginDestination("https://evil.example"), "/dashboard");
});

test("mock provider covers all structured operations and visibly marks storyboard", async () => {
  const provider = new FallbackAIProvider(); const analysis = await provider.analyzeLesson({ title: "Phân số", summary: "Một phần của tổng thể" });
  const script = await provider.generateScript({ title: "Phân số", analysis }); const review = await provider.validateScript(script); const storyboard = await provider.generateStoryboard({ ...script, duration: 30 }); const metadata = await provider.generateMetadata({ lessonTitle: "Phân số", script });
  const { validateScript } = await import("../lib/ai/validator.ts"); assert.equal(validateScript(script).valid, true);
  assert.equal(review.valid, true); assert.equal(storyboard.aspectRatio, "9:16"); assert.equal(storyboard.fps, 30); assert.equal(storyboard.scenes.length, 4); assert.equal(storyboard.scenes[0].startTime, 0); assert.equal(storyboard.scenes.at(-1).endTime, 30); assert.match(storyboard.scenes[0].visualDescription, /MOCK/); assert.ok(storyboard.scenes[0].assetRequirements.length); assert.ok(metadata.tags.length);
});

test("mock YouTube never reports a real publication", async () => {
  const { MockYouTubeProvider } = await import("../lib/youtube.ts");
  const result = await new MockYouTubeProvider().upload("video.mp4", { title: "Mock", description: "", tags: [], hashtags: [] }, "private");
  assert.equal(result.published, false);
  assert.match(result.message, /Mock mode/);
});
