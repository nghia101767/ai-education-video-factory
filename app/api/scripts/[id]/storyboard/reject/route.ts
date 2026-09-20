import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Storyboard } from "@/models";
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) { await connectToDatabase(); const item = await Storyboard.findOneAndUpdate({ scriptId: (await params).id }, { $set: { status: "rejected", rejectedAt: new Date() }, $unset: { approvedAt: "" } }, { sort: { version: -1 }, new: true }).lean(); return item ? NextResponse.json(item) : NextResponse.json({ error: "Chưa có Storyboard." }, { status: 404 }); }
