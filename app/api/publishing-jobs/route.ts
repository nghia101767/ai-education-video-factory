import { NextResponse } from "next/server"; import { connectToDatabase } from "@/lib/mongodb"; import { PublishingJob } from "@/models";
export async function GET() { await connectToDatabase(); return NextResponse.json(await PublishingJob.find().sort({ createdAt: -1 }).limit(50).lean()); }
