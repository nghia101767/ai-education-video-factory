import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Script } from "@/models";
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Script ID không hợp lệ." }, { status: 400 });
    await connectToDatabase();
    const item = await Script.findByIdAndUpdate(id, { $set: { status: "rejected", rejectedAt: new Date() }, $unset: { approvedAt: "" } }, { new: true }).lean();
    return item ? NextResponse.json(item) : NextResponse.json({ error: "Script not found" }, { status: 404 });
  } catch { return NextResponse.json({ error: "Không thể từ chối kịch bản." }, { status: 500 }); }
}
