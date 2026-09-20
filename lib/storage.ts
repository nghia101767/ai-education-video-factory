import { promises as fs } from "node:fs";
import path from "node:path";
import { env } from "@/lib/env";

export type StorageFolder = "textbooks" | "documents" | "images" | "audio" | "videos" | "subtitles" | "thumbnails" | "temp" | "logs";
export class StorageService {
  constructor(private readonly root = env.storageRoot) {}
  private path(folder: StorageFolder, filename: string) {
    if (!filename || path.isAbsolute(filename) || filename.includes("\0")) throw new Error("Invalid storage path");
    const base = path.resolve(this.root, folder);
    const target = path.resolve(base, filename);
    if (target !== base && !target.startsWith(`${base}${path.sep}`)) throw new Error("Invalid storage path");
    return target;
  }
  async createDirectory(folder?: StorageFolder) { await fs.mkdir(folder ? path.resolve(this.root, folder) : this.root, { recursive: true }); }
  async save(folder: StorageFolder, filename: string, data: Buffer | string) { const target = this.path(folder, filename); await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, data); return target; }
  read(folder: StorageFolder, filename: string) { return fs.readFile(this.path(folder, filename)); }
  delete(folder: StorageFolder, filename: string) { return fs.rm(this.path(folder, filename), { force: true }); }
  async exists(folder: StorageFolder, filename: string) { try { await fs.access(this.path(folder, filename)); return true; } catch { return false; } }
  getPath(folder: StorageFolder, filename: string) { return this.path(folder, filename); }
}
export const storage = new StorageService();
