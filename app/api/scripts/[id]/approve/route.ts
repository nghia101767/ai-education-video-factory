import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Script } from "@/models";
import { validateScript } from "@/lib/ai/validator";
import { scriptSchema, scriptFields, SCRIPT_SCHEMA_VERSION } from "@/lib/ai/script-schema";
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Script ID không hợp lệ." }, { status: 400 });
    await connectToDatabase();
    const script = await Script.findById(id).lean() as Record<string, unknown> | null;
    if (!script) return NextResponse.json({ error: "Script not found" }, { status: 404 });
    const valid = script.schemaVersion === SCRIPT_SCHEMA_VERSION ? scriptSchema.safeParse(scriptFields(script)).success : validateScript(script).valid;
    if (!valid) return NextResponse.json({ error: "Chỉ duyệt kịch bản hợp lệ 25–35 giây." }, { status: 422 });
    const item = await Script.findOneAndUpdate({ _id: id, updatedAt: script.updatedAt }, { $set: { status: "approved", approvedAt: new Date(), validation: { valid: true, errors: [], warnings: [] } }, $unset: { rejectedAt: "" } }, { new: true }).lean();
    return item ? NextResponse.json(item) : NextResponse.json({ error: "Kịch bản vừa thay đổi. Vui lòng tải lại." }, { status: 409 });
  } catch { return NextResponse.json({ error: "Không thể duyệt kịch bản." }, { status: 500 }); }
}
