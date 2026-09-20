import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { AIUsage, Video } from "@/models";
import { getCostSummary } from "@/lib/ai/usage-service";

export async function GET(request: Request) {
  await connectToDatabase();
  const now = new Date(); const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0); const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const url = new URL(request.url); const from = url.searchParams.get("from"); const to = url.searchParams.get("to");
  const [summary, totals, videos] = await Promise.all([
    getCostSummary(from ? new Date(from) : monthStart, to ? new Date(to) : now),
    AIUsage.aggregate([{ $match: { createdAt: { $gte: monthStart, $lte: now } } }, { $group: { _id: null, monthly: { $sum: { $ifNull: ["$estimatedCost", 0] } }, daily: { $sum: { $cond: [{ $gte: ["$createdAt", dayStart] }, { $ifNull: ["$estimatedCost", 0] }, 0] } }, requests: { $sum: 1 }, cached: { $sum: { $cond: ["$cached", 1, 0] } }, failures: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } }, unknownCost: { $sum: { $cond: [{ $eq: ["$estimatedCost", null] }, 1, 0] } } } }]),
    Video.countDocuments({ createdAt: { $gte: monthStart }, status: { $in: ["ready_for_review", "approved", "published"] } }),
  ]);
  const values = totals[0] || { daily: 0, monthly: 0, requests: 0, cached: 0, failures: 0, unknownCost: 0 };
  return NextResponse.json({ currency: "USD", pricingConfigured: Boolean(process.env.AI_PRICING_JSON), summary, totals: { ...values, averagePerVideo: videos ? values.monthly / videos : null }, budgets: { daily: Number(process.env.DAILY_AI_BUDGET || 0), monthly: Number(process.env.MONTHLY_AI_BUDGET || 0) } });
}
