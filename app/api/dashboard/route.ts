import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { AIUsage, Grade, Lesson, PublishingJob, RenderJob, Script, Subject, Textbook, Video } from "@/models";
import { storageStatistics } from "@/lib/storage-stats";

export async function GET() {
  try {
    await connectToDatabase();
    const startDay = new Date(); startDay.setHours(0, 0, 0, 0); const startMonth = new Date(startDay.getFullYear(), startDay.getMonth(), 1);
    const [subjects, grades, textbooks, lessons, scripts, videos, renderJobs, publishedVideos, costs, storage, recentJobs] = await Promise.all([
      Subject.countDocuments(), Grade.countDocuments(), Textbook.countDocuments(), Lesson.countDocuments(), Script.countDocuments(), Video.countDocuments(),
      RenderJob.countDocuments({ status: { $in: ["queued", "processing"] } }), Video.countDocuments({ status: "published" }),
      AIUsage.aggregate([{ $match: { createdAt: { $gte: startMonth }, estimatedCost: { $ne: null } } }, { $group: { _id: null, month: { $sum: "$estimatedCost" }, today: { $sum: { $cond: [{ $gte: ["$createdAt", startDay] }, "$estimatedCost", 0] } } } }]),
      storageStatistics(), RenderJob.find().sort({ createdAt: -1 }).limit(5).populate("videoId", "title").lean(),
    ]);
    const storageBytes = Object.values(storage).reduce((sum, value) => sum + value.bytes, 0);
    return NextResponse.json({ counts: { subjects, grades, textbooks, lessons, scripts, videos, renderJobs, publishedVideos }, costs: costs[0] || { today: 0, month: 0 }, storage: { ...storage, totalBytes: storageBytes }, recentJobs, publishingQueued: await PublishingJob.countDocuments({ status: { $in: ["queued", "uploading"] } }) });
  } catch { return NextResponse.json({ error: "Unable to load dashboard" }, { status: 500 }); }
}
