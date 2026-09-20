// Database verification for tests/browser-script.mjs. Additive and Step-7-only; never deletes data.
import assert from "node:assert/strict";
import fs from "node:fs";
import mongoose from "mongoose";
import { AIUsage, LessonAnalysis, Script, Scene, Asset, Video } from "../models/index.ts";
import { generateLessonScript } from "../lib/script-generation-service.ts";
const fixturePath = fs.existsSync("/app/storage/logs/script-openai.json") ? "/app/storage/logs/script-openai.json" : "storage/logs/script-openai.json";
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
await mongoose.connect(process.env.MONGODB_URI);
try {
  const analysis = await LessonAnalysis.findById(fixture.analysisId).lean(); assert.ok(analysis); assert.equal(analysis.provider, "openai");
  const initial = await Script.findById(fixture.initialScriptId).lean(); const regenerated = await Script.findById(fixture.regeneratedScriptId).lean(); assert.ok(initial); assert.ok(regenerated);
  assert.equal(String(initial.analysisId), fixture.analysisId); assert.equal(initial.provider, "openai"); assert.equal(initial.schemaVersion, "script-schema-v2"); assert.equal(initial.status, "rejected"); assert.equal(initial.manuallyEdited, true);
  assert.equal(regenerated.provider, "openai"); assert.equal(regenerated.status, "draft"); assert.equal(regenerated.version, initial.version + 1);
  const initialUsage = await AIUsage.find({ scriptId: initial._id, operation: "script_generation", status: "success" }).sort({ createdAt: 1 }).lean();
  assert.equal(initialUsage.length, 2); assert.equal(initialUsage[0].cached, false); assert.ok(initialUsage[0].inputTokens > 0); assert.ok(initialUsage[0].outputTokens > 0); assert.equal(initialUsage[1].cached, true); assert.equal(initialUsage[1].estimatedCost, 0); assert.equal(initialUsage[0].requestId, initial.usage.requestId);
  const regeneratedUsage = await AIUsage.find({ scriptId: regenerated._id, operation: "script_generation", status: "success", cached: { $ne: true } }).lean(); assert.equal(regeneratedUsage.length, 1); assert.ok(regeneratedUsage[0].inputTokens > 0);
  let missingCalls = 0; await assert.rejects(generateLessonScript(fixture.lessonId, { force: true, analysisId: "000000000000000000000001" }, { name: "test-missing-analysis", generateScript: async () => { missingCalls++; return {}; } }), error => error.code === "ANALYSIS_REQUIRED"); assert.equal(missingCalls, 0);
  const countBeforeInvalid = await Script.countDocuments({ lessonId: fixture.lessonId }); let invalidCalls = 0;
  await assert.rejects(generateLessonScript(fixture.lessonId, { force: true, analysisId: fixture.analysisId }, { name: "test-invalid-script", generateScript: async () => { invalidCalls++; return { wrong: true }; } }), error => error.code === "AI_INVALID_OUTPUT"); assert.equal(invalidCalls, 1); assert.equal(await Script.countDocuments({ lessonId: fixture.lessonId }), countBeforeInvalid);
  const oldAggregate = AIUsage.aggregate, oldDaily = process.env.DAILY_AI_BUDGET, oldPricing = process.env.AI_PRICING_JSON; let budgetCalls = 0;
  try {
    process.env.DAILY_AI_BUDGET = "1"; process.env.AI_PRICING_JSON = JSON.stringify({ rules: { [`openai:${process.env.OPENAI_SCRIPT_MODEL || "gpt-5.6-luna"}`]: { inputPerMillionTokens: 1, outputPerMillionTokens: 1, cachedInputPerMillionTokens: 1 } } }); AIUsage.aggregate = async () => [{ total: 2 }];
    await assert.rejects(generateLessonScript(fixture.lessonId, { force: true, analysisId: fixture.analysisId }, { name: "test-budget-script", generateScript: async () => { budgetCalls++; return {}; } }), /budget exceeded/); assert.equal(budgetCalls, 0);
  } finally { AIUsage.aggregate = oldAggregate; if (oldDaily === undefined) delete process.env.DAILY_AI_BUDGET; else process.env.DAILY_AI_BUDGET = oldDaily; if (oldPricing === undefined) delete process.env.AI_PRICING_JSON; else process.env.AI_PRICING_JSON = oldPricing; }
  const scriptIds = (await Script.find({ lessonId: fixture.lessonId }).select("_id").lean()).map(item => item._id);
  const downstream = { scenes: await Scene.countDocuments({ scriptId: { $in: scriptIds } }), videos: await Video.countDocuments({ scriptId: { $in: scriptIds } }), assets: await Asset.countDocuments({ sceneId: { $in: await Scene.find({ scriptId: { $in: scriptIds } }).distinct("_id") } }) }; assert.deepEqual(downstream, { scenes: 0, videos: 0, assets: 0 });
  const result = { status: "PASS", checkedAt: new Date().toISOString(), lessonId: fixture.lessonId, analysisId: fixture.analysisId, initialScriptId: String(initial._id), regeneratedScriptId: String(regenerated._id), mongoPersistence: true, step6Provider: analysis.provider, initialAIUsageIds: initialUsage.map(item => String(item._id)), regeneratedAIUsageIds: regeneratedUsage.map(item => String(item._id)), initialTokens: { input: initialUsage[0].inputTokens, output: initialUsage[0].outputTokens, cachedInput: initialUsage[0].cachedInputTokens }, regeneratedTokens: { input: regeneratedUsage[0].inputTokens, output: regeneratedUsage[0].outputTokens, cachedInput: regeneratedUsage[0].cachedInputTokens }, cacheHitRecorded: true, missingAnalysisNoProviderCall: true, invalidOutputNotSaved: true, budgetBlockedBeforeProvider: true, downstreamUntouched: downstream };
  const outputPath = fixturePath.replace("script-openai.json", "script-openai-database.json"); fs.writeFileSync(outputPath, JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2));
} finally { await mongoose.disconnect(); }
