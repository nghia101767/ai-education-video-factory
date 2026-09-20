import { NextResponse } from "next/server";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { Types } from "mongoose";
import { storage } from "@/lib/storage";
import { validateUploadContent } from "@/lib/upload-validation";
import { processDocument } from "@/lib/document-processing";
import { connectToDatabase } from "@/lib/mongodb";
import { Lesson, SourceDocument } from "@/models";

const allowed = new Set(["application/pdf", "text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/png", "image/jpeg"]);
const maxSize = Math.max(1, Number(process.env.MAX_UPLOAD_SIZE || 50 * 1024 * 1024));

export async function POST(request: Request) {
  let savedFilename = ""; let itemId = "";
  try {
    const form = await request.formData(); const value = form.get("file"); const lessonId = String(form.get("lessonId") || "");
    if (!(value instanceof File)) return NextResponse.json({ error: "file is required" }, { status: 400 });
    if (lessonId && !Types.ObjectId.isValid(lessonId)) return NextResponse.json({ error: "Invalid lessonId" }, { status: 400 });
    await connectToDatabase();
    if (lessonId && !await Lesson.exists({ _id: lessonId })) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    if (!allowed.has(value.type)) return NextResponse.json({ error: "Unsupported file type" }, { status: 415 });
    if (value.size > maxSize) return NextResponse.json({ error: `File exceeds ${Math.round(maxSize / 1024 / 1024)}MB limit` }, { status: 413 });
    const content = Buffer.from(await value.arrayBuffer()); validateUploadContent(value.name, value.type, content);
    const extension = path.extname(value.name).toLowerCase(); savedFilename = `${randomUUID()}${extension}`;
    await storage.save("documents", savedFilename, content);
    const item = await SourceDocument.create({
      lessonId: lessonId || undefined, filename: savedFilename, originalName: value.name, mimeType: value.type, size: value.size,
      hash: createHash("sha256").update(content).digest("hex"), storagePath: `documents/${savedFilename}`, processingStatus: "UPLOADED",
      metadata: { uploadedAt: new Date().toISOString() },
    });
    itemId = String(item._id); await SourceDocument.updateOne({ _id: item._id }, { processingStatus: "PROCESSING" });
    const extraction = await processDocument(content, value.type);
    await SourceDocument.updateOne({ _id: item._id }, { processingStatus: extraction.processingStatus, extractedText: extraction.extractedText, extractedCharacterCount: extraction.extractedText?.length || 0, metadata: { uploadedAt: new Date().toISOString(), ...extraction.metadata } });
    if (lessonId) await Lesson.updateOne({ _id: lessonId }, { $addToSet: { sourceDocumentIds: item._id } });
    return NextResponse.json(await SourceDocument.findById(item._id).lean(), { status: 201 });
  } catch (error) {
    if (itemId) await SourceDocument.updateOne({ _id: itemId }, { $set: { processingStatus: "FAILED", "metadata.extractionError": error instanceof Error ? error.message : "Upload failed" } }).catch(() => undefined);
    else if (savedFilename) await storage.delete("documents", savedFilename).catch(() => undefined);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed" }, { status: 400 });
  }
}
