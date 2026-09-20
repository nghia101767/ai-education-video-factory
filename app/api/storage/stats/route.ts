import { NextResponse } from "next/server"; import { storageStatistics } from "@/lib/storage-stats";
export async function GET() { try { return NextResponse.json(await storageStatistics()); } catch { return NextResponse.json({ error: "Unable to scan storage" }, { status: 500 }); } }
