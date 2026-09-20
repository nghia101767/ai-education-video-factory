import { createHash } from "node:crypto";
import mammoth from "mammoth";
// The package root contains a CLI/demo branch that Next can execute while
// collecting route data. Import the side-effect-free parser implementation.
import parsePdf from "pdf-parse/lib/pdf-parse.js";

const MAX_EXTRACTED_CHARACTERS = 1_000_000;

export type DocumentExtraction = {
  hash: string;
  processingStatus: "READY" | "OCR_NOT_CONFIGURED" | "FAILED";
  extractedText?: string;
  metadata: Record<string, unknown>;
};

export interface OCRProvider { name: string; extract(content: Buffer): Promise<{ text?: string; mock: boolean; message: string }> }
export class MockOCRProvider implements OCRProvider { name = "mock-ocr"; async extract(content: Buffer) { void content; return { text: "[MOCK OCR] Nội dung ảnh mô phỏng dùng để kiểm thử pipeline. Đây không phải kết quả nhận dạng chữ thực tế.", mock: true, message: "MOCK OCR placeholder generated" }; } }

export async function processDocument(content: Buffer, mimeType: string): Promise<DocumentExtraction> {
  const hash = createHash("sha256").update(content).digest("hex");
  try {
    if (mimeType.startsWith("image/")) {
      if (process.env.MOCK_AI === "true") { const result = await new MockOCRProvider().extract(content); return { hash, processingStatus: "READY", extractedText: result.text, metadata: { extraction: "mock-ocr", mock: true, message: result.message, extractedCharacterCount: result.text?.length || 0 } }; }
      return { hash, processingStatus: "OCR_NOT_CONFIGURED", metadata: { extraction: "ocr", reason: "OCR provider is not configured" } };
    }
    let text = "";
    let metadata: Record<string, unknown> = {};
    if (mimeType === "text/plain") {
      text = content.toString("utf8");
      metadata = { extraction: "utf8" };
    } else if (mimeType === "application/pdf") {
      const parsed = await parsePdf(content);
      text = parsed.text;
      metadata = { extraction: "pdf-text-layer", pages: parsed.numpages };
    } else if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const parsed = await mammoth.extractRawText({ buffer: content });
      text = parsed.value;
      metadata = { extraction: "docx", warnings: parsed.messages.map((message) => message.message) };
    } else {
      throw new Error("Unsupported document type");
    }
    const normalized = text.replace(/\u0000/g, "").replace(/\r\n/g, "\n").trim().slice(0, MAX_EXTRACTED_CHARACTERS);
    if (!normalized) throw new Error("Document contains no extractable text");
    return { hash, processingStatus: "READY", extractedText: normalized, metadata: { ...metadata, extractedCharacterCount: normalized.length } };
  } catch (error) {
    return { hash, processingStatus: "FAILED", metadata: { extractionError: error instanceof Error ? error.message : "Document extraction failed" } };
  }
}
