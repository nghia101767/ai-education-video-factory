declare module "pdf-parse/lib/pdf-parse.js" {
  export type PDFData = { numpages: number; numrender: number; info: unknown; metadata: unknown; text: string; version: string };
  export default function parse(buffer: Buffer): Promise<PDFData>;
}
