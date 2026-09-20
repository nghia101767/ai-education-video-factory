import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Script } from "@/models";
import { validateScript } from "@/lib/ai/validator";
import { scriptSchema, scriptFields, SCRIPT_SCHEMA_VERSION } from "@/lib/ai/script-schema";
const legacyEditable = ["title", "hook", "narration", "targetAudience", "educationalGoal", "callToAction"];
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Script ID không hợp lệ." }, { status: 400 });
  await connectToDatabase();
  const item = await Script.findById(id).lean();
  return item ? NextResponse.json(item) : NextResponse.json({ error: "Script not found" }, { status: 404 });
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Script ID không hợp lệ." }, { status: 400 });
    const raw = await request.json();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return NextResponse.json({ error: "JSON object is required" }, { status: 400 });
    await connectToDatabase();
    const current = await Script.findById(id).lean() as Record<string, unknown> | null;
    if (!current) return NextResponse.json({ error: "Script not found" }, { status: 404 });
    const v2 = current.schemaVersion === SCRIPT_SCHEMA_VERSION;
    const editable = v2 ? Object.keys(scriptSchema.shape) : legacyEditable;
    if (Object.keys(raw).some(key => !editable.includes(key))) return NextResponse.json({ error: "Unsupported script field" }, { status: 400 });
    const merged = { ...current, ...raw };
    const parsed = v2 ? scriptSchema.safeParse(scriptFields(merged)) : null;
    const validation = validateScript(merged);
    if ((v2 && !parsed?.success) || (!v2 && !validation.valid)) return NextResponse.json({ error: "Kịch bản không hợp lệ.", details: parsed && !parsed.success ? parsed.error.issues.map(issue => issue.message) : validation.errors }, { status: 422 });
    const fields = parsed?.success ? parsed.data : raw;
    const item = await Script.findOneAndUpdate({ _id: id, updatedAt: current.updatedAt }, { $set: { ...fields, duration: parsed?.success ? parsed.data.estimatedDuration : validation.estimatedDuration, wordCount: String(merged.narration).trim().split(/\s+/).length, validation: { valid: true, errors: [], warnings: [] }, status: v2 ? "draft" : "review", manuallyEdited: true }, $unset: { approvedAt: "", rejectedAt: "" } }, { new: true, runValidators: true }).lean();
    return item ? NextResponse.json(item) : NextResponse.json({ error: "Kịch bản vừa thay đổi. Vui lòng tải lại." }, { status: 409 });
  } catch { return NextResponse.json({ error: "Không thể lưu kịch bản." }, { status: 400 }); }
}
