import { NextResponse } from "next/server"; import { connectToDatabase } from "@/lib/mongodb"; import { RenderJob } from "@/models";
export async function GET() { await connectToDatabase(); return NextResponse.json(await RenderJob.find().sort({ createdAt: -1 }).limit(50).populate("videoId", "title status").lean()); }
