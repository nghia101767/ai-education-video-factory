import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Scene, Script, Storyboard } from "@/models";
import { storyboardOutputSchema } from "@/lib/ai/storyboard-schema";
import { validateStoryboard } from "@/lib/storyboard";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = (await params).id; if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Script ID không hợp lệ." }, { status: 400 });
    const raw = await request.json(); const parsed = storyboardOutputSchema.safeParse(raw); if (!parsed.success) return NextResponse.json({ error: "Storyboard không hợp lệ.", details: parsed.error.issues.map(issue => issue.message) }, { status: 422 });
    await connectToDatabase(); const script = await Script.findById(id).lean() as Record<string, unknown> | null; if (!script) return NextResponse.json({ error: "Không tìm thấy kịch bản." }, { status: 404 });
    if (script.status !== "approved") return NextResponse.json({ error: "Kịch bản phải được phê duyệt trước khi tạo Storyboard." }, { status: 400 });
    const target = Number(script.targetDuration || script.estimatedDuration || script.duration || 30); const validation = validateStoryboard(parsed.data.scenes, target); if (!validation.valid) return NextResponse.json({ error: validation.errors.join("; "), validation }, { status: 422 });
    const storyboard = await Storyboard.findOne({ scriptId: id }).sort({ version: -1 }); if (!storyboard) return NextResponse.json({ error: "Chưa có Storyboard." }, { status: 404 });
    const existing = await Scene.find({ scriptId: id, storyboardId: storyboard._id }).sort({ sceneNumber: 1 });
    if (existing.length !== parsed.data.scenes.length) return NextResponse.json({ error: "Lưu thủ công phải giữ nguyên số lượng cảnh." }, { status: 422 });
    await Scene.bulkWrite(parsed.data.scenes.map((scene, index) => ({ updateOne: { filter: { _id: existing[index]._id }, update: { $set: { ...scene, sceneNumber: scene.order, imagePrompt: scene.assetRequirements.map(item => item.description).join("; "), subtitleText: scene.onScreenText || scene.narration, status: "draft" } } } })));
    Object.assign(storyboard, { ...parsed.data, manuallyEdited: true, status: "draft", approvedAt: undefined, rejectedAt: undefined }); await storyboard.save();
    const scenes = await Scene.find({ scriptId: id }).sort({ sceneNumber: 1 }).lean(); return NextResponse.json({ ...storyboard.toObject(), scenes, validation });
  } catch { return NextResponse.json({ error: "Không thể lưu Storyboard." }, { status: 400 }); }
}
