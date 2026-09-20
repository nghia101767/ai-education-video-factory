import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MockImageProvider } from "../lib/ai/image-provider.ts";
import { storage } from "../lib/storage.ts";
import { checkBudget, recordCacheHit, recordUsage, BudgetExceededError } from "../lib/ai/usage-service.ts";

await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
const request = { prompt: `Step 10 marked mock cache verification ${Date.now()}`, type: "diagram", style: "verification", aspectRatio: "9:16", dimensions: { width: 1080, height: 1920 }, settings: { run: "step10" } };
const provider = new MockImageProvider();
const first = await provider.generateImage(request); const second = await provider.generateImage(request);
assert.equal(first.status, "mock"); assert.equal(first.cached, false); assert.equal(second.cached, true); assert.equal(second.storagePath, first.storagePath);
const bytes = await storage.read("images", first.storagePath.slice("images/".length)); assert.match(bytes.toString("utf8"), /MOCK ASSET/);
const cacheKey = first.storagePath.slice(7, -4);
await recordUsage({ provider: provider.name, providerType: "local", model: "gpt-image-1", operation: "image_generation", storyboardId: new mongoose.Types.ObjectId("6aa53aeb0c3c1db7afee71a6"), imageCount: 1, cached: false, cacheKey, status: "success", success: true });
await recordCacheHit({ provider: provider.name, providerType: "local", model: "gpt-image-1", operation: "image_generation", storyboardId: new mongoose.Types.ObjectId("6aa53aeb0c3c1db7afee71a6"), imageCount: 0, cacheKey, cacheSource: "mock-provider-file" });
const usages = await db.collection("aiusages").find({ cacheKey }).sort({ createdAt: 1 }).toArray(); assert.equal(usages.length, 2); assert.deepEqual(usages.map(item => item.cached), [false, true]); assert.deepEqual(usages.map(item => item.estimatedCost), [0, 0]);
const budgetFixtureKey = "step10-runtime-budget-fixture";
const budgetFixture = await db.collection("aiusages").findOneAndUpdate({ cacheKey: budgetFixtureKey }, { $setOnInsert: { provider: "verification-fixture", providerType: "local", model: "none", operation: "budget_verification", cacheKey: budgetFixtureKey, estimatedCost: 0.01, cached: false, status: "success", success: true, currency: "USD", createdAt: new Date(), updatedAt: new Date() } }, { upsert: true, returnDocument: "after" });
const oldDaily = process.env.DAILY_AI_BUDGET; process.env.DAILY_AI_BUDGET = "0.000000001"; let budgetBlocked = false;
try { await checkBudget(); } catch (error) { assert.ok(error instanceof BudgetExceededError); budgetBlocked = true; }
if (oldDaily === undefined) delete process.env.DAILY_AI_BUDGET; else process.env.DAILY_AI_BUDGET = oldDaily;
assert.equal(budgetBlocked, true);
console.log(JSON.stringify({ result: "PASS", provider: provider.name, first: "MISS", second: "HIT", storagePath: first.storagePath, markedSvg: true, dimensions: [first.width, first.height], aiUsageIds: usages.map(item => String(item._id)), aiUsageCached: usages.map(item => item.cached), estimatedCosts: usages.map(item => item.estimatedCost), budgetFixtureId: String(budgetFixture._id), budgetGuard: "BLOCKED before provider action" }, null, 2));
await mongoose.disconnect();
