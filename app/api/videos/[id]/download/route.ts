import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { resolveStoragePath } from "@/lib/render-engine";
import { Video } from "@/models";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) { await connectToDatabase(); const video = await Video.findById((await params).id).select("title outputPath status").lean() as unknown as { title: string; outputPath?: string; status: string } | null; if (!video) return NextResponse.json({ error: "Video not found" }, { status: 404 }); if (!video.outputPath || !["ready_for_review","approved","rejected","published"].includes(video.status)) return NextResponse.json({ error: "Rendered video is not available" }, { status: 409 }); try { const data = await fs.readFile(resolveStoragePath(video.outputPath)); const safeName = `${video.title.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 80) || "video"}${path.extname(video.outputPath) || ".mp4"}`; return new NextResponse(data, { headers: { "Content-Type": "video/mp4", "Content-Length": String(data.length), "Content-Disposition": `attachment; filename="${safeName}"`, "Cache-Control": "private, no-store" } }); } catch { return NextResponse.json({ error: "Rendered file is missing" }, { status: 404 }); } }
