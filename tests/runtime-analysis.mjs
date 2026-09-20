// Run in worker after browser-analysis.mjs. Only step 6; no destructive cleanup.
import assert from "node:assert/strict";
import fs from "node:fs";
import mongoose from "mongoose";
import { analyzeLesson } from "../lib/lesson-analysis-service.ts";
import { Lesson, LessonAnalysis, AIUsage, SourceDocument } from "../models/index.ts";
const mode = process.env.E2E_ANALYSIS_PROVIDER || "mock";
const fixture = JSON.parse(fs.readFileSync(`/app/storage/logs/analysis-${mode}.json`, "utf8"));
await mongoose.connect(process.env.MONGODB_URI);
try {
  const stored = await LessonAnalysis.findById(fixture.analysisId).lean(); assert.ok(stored);
  assert.equal(stored.provider, fixture.provider); assert.equal(stored.schemaVersion, "lesson-analysis-schema-v1");
  const source = await SourceDocument.findById(fixture.sourceDocumentId).select("+extractedText"); assert.ok(source.extractedText.includes("1/2"));
  const usages = await AIUsage.find({ lessonId: fixture.lessonId, operation: "lesson_analysis", status: "success" }).sort({ createdAt: 1 }).lean();
  assert.equal(usages.length, 2); assert.equal(usages[0].cached, false); assert.equal(usages[1].cached, true); assert.equal(usages[1].estimatedCost, 0);
  if (mode === "openai") { assert.ok(usages[0].inputTokens > 0); assert.ok(usages[0].outputTokens > 0); }
  const count = await LessonAnalysis.countDocuments({ lessonId: fixture.lessonId });
  await assert.rejects(analyzeLesson(fixture.lessonId, true, { name: "mock-invalid-schema", analyzeLesson: async () => ({ invalid: true }) }), error => error.code === "AI_INVALID_OUTPUT");
  assert.equal(await LessonAnalysis.countDocuments({ lessonId: fixture.lessonId }), count);
  const beforeAggregate = AIUsage.aggregate, oldDaily = process.env.DAILY_AI_BUDGET, oldPricing = process.env.AI_PRICING_JSON;
  let providerCalls = 0;
  try {
    process.env.DAILY_AI_BUDGET = "1";
    // Test-only rates unblock pricing validation so the injected spend is tested.
    // The provider must never run; these rates are not production pricing.
    process.env.AI_PRICING_JSON = JSON.stringify({ rules: { [`openai:${process.env.OPENAI_ANALYSIS_MODEL || "gpt-5.6-luna"}`]: { inputPerMillionTokens: 1, outputPerMillionTokens: 1, cachedInputPerMillionTokens: 1 } } });
    AIUsage.aggregate = async () => [{ total: 2 }];
    await assert.rejects(analyzeLesson(fixture.lessonId, true, { name: "mock-budget-test", analyzeLesson: async () => { providerCalls++; return {}; } }), /budget exceeded/);
    assert.equal(providerCalls, 0);
  } finally { AIUsage.aggregate = beforeAggregate; if (oldDaily === undefined) delete process.env.DAILY_AI_BUDGET; else process.env.DAILY_AI_BUDGET = oldDaily; if (oldPricing === undefined) delete process.env.AI_PRICING_JSON; else process.env.AI_PRICING_JSON = oldPricing; }
  let historyAndInvalidation = "NOT_RUN";
  if (mode === "mock") {
    const forced = await analyzeLesson(fixture.lessonId, true); assert.equal(forced.version, stored.version + 1); assert.equal(forced.cached, false);
    await Lesson.updateOne({ _id: fixture.lessonId }, { summary: "Chia hình thành hai phần bằng nhau rồi lấy một phần. Bổ sung nội dung để kiểm tra cache." });
    const changed = await analyzeLesson(fixture.lessonId); assert.equal(changed.cached, false); assert.notEqual(changed.cacheKey, stored.cacheKey); assert.equal(changed.version, forced.version + 1);
    historyAndInvalidation = "PASS";
  }
  const result = { status: "PASS", mode, analysisId: String(stored._id), lessonId: fixture.lessonId, mongoPersistence: true, initialUsageCount: usages.length, cache: "PASS", invalidOutputNotSaved: true, budgetGuardWithInjectedTotals: true, historyAndInvalidation };
  fs.writeFileSync(`/app/storage/logs/analysis-${mode}-database.json`, JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
} finally { await mongoose.disconnect(); }
