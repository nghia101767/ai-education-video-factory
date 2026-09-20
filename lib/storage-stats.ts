import { promises as fs } from "node:fs"; import path from "node:path"; import { env } from "@/lib/env";
const folders = ["images", "audio", "videos", "documents"] as const;
async function sizeOf(folder: string) { let total = 0; let files = 0; async function walk(dir: string) { for (const entry of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) { const target = path.join(dir, entry.name); if (entry.isDirectory()) await walk(target); else { total += (await fs.stat(target)).size; files += 1; } } } await walk(path.join(env.storageRoot, folder)); return { files, bytes: total }; }
export async function storageStatistics() { const values = await Promise.all(folders.map(async (folder) => [folder, await sizeOf(folder)] as const)); return Object.fromEntries(values); }
