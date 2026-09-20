import path from "node:path";
const allowedExtensions: Record<string, string[]> = { "application/pdf": [".pdf"], "text/plain": [".txt"], "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"], "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"], "image/webp": [".webp"] };
const startsWith = (data: Buffer, bytes: number[]) => bytes.every((byte, index) => data[index] === byte);
export function validateUploadContent(name: string, mimeType: string, data: Buffer) {
  const extension = path.extname(name).toLowerCase();
  if (!allowedExtensions[mimeType]?.includes(extension)) throw new Error("File extension does not match MIME type");
  const valid = mimeType === "application/pdf" ? data.subarray(0, 5).toString() === "%PDF-" : mimeType === "image/png" ? startsWith(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) : mimeType === "image/jpeg" ? startsWith(data, [0xff, 0xd8, 0xff]) : mimeType === "image/webp" ? data.subarray(0, 4).toString() === "RIFF" && data.subarray(8, 12).toString() === "WEBP" : mimeType.includes("wordprocessingml") ? startsWith(data, [0x50, 0x4b, 0x03, 0x04]) : mimeType === "text/plain" ? !data.includes(0) : false;
  if (!valid) throw new Error("File content does not match declared MIME type");
}

export function validateAssetUpload(name: string, mimeType: string, data: Buffer, type: string) {
  const extension = path.extname(name).toLowerCase();
  const allowed: Record<string, string[]> = { image: [".png", ".jpg", ".jpeg", ".webp"], thumbnail: [".png", ".jpg", ".jpeg", ".webp"], audio: [".mp3", ".wav", ".m4a"], music: [".mp3", ".wav", ".m4a"], sfx: [".mp3", ".wav", ".m4a"], video: [".mp4", ".mov", ".webm"] };
  if (!allowed[type]?.includes(extension)) throw new Error("Unsupported asset extension");
  const category = type === "thumbnail" ? "image" : ["music", "sfx"].includes(type) ? "audio" : type;
  if (!mimeType.startsWith(category + "/")) throw new Error("MIME type does not match asset type");
  const imageSignature = mimeType === "image/png" ? startsWith(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) && data.includes(Buffer.from("IEND"))
    : mimeType === "image/jpeg" ? startsWith(data, [0xff, 0xd8, 0xff]) && data.length > 4 && data[data.length - 2] === 0xff && data[data.length - 1] === 0xd9
      : mimeType === "image/webp" ? data.length >= 20 && data.subarray(0, 4).toString() === "RIFF" && data.subarray(8, 12).toString() === "WEBP" && data.readUInt32LE(4) + 8 <= data.length : false;
  const signatureValid = category === "image"
    ? imageSignature
    : category === "audio"
      ? data.subarray(0, 3).toString() === "ID3" || data.subarray(0, 4).toString() === "RIFF" || data.subarray(4, 8).toString() === "ftyp" || startsWith(data, [0xff, 0xfb]) || startsWith(data, [0xff, 0xf3]) || startsWith(data, [0xff, 0xf2])
      : category === "video" ? data.subarray(4, 8).toString() === "ftyp" || startsWith(data, [0x1a, 0x45, 0xdf, 0xa3]) : false;
  if (!signatureValid) throw new Error("Asset content does not match declared MIME type");
}
