import { Types } from "mongoose";

export const resources = ["subjects", "grades", "textbooks", "lessons", "source-documents"] as const;
export type Resource = typeof resources[number];
export function isResource(value: string): value is Resource { return resources.includes(value as Resource); }
export function slugify(value: string) { return value.toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/(^-|-$)/g, ""); }

const fields: Record<Resource, string[]> = {
  subjects: ["name", "slug", "description", "icon", "order", "status"],
  grades: ["name", "level", "description", "order", "status"],
  textbooks: ["name", "publisher", "gradeId", "subjectId", "edition", "description", "status"],
  lessons: ["title", "slug", "textbookId", "subjectId", "gradeId", "chapter", "lessonNumber", "description", "objectives", "summary", "keyConcepts", "status"],
  "source-documents": ["lessonId", "filename", "originalName", "mimeType", "size", "hash", "storagePath", "processingStatus", "extractedText", "extractedCharacterCount", "metadata"],
};
const required: Record<Resource, string[]> = {
  subjects: ["name"],
  grades: ["name", "level"],
  textbooks: ["name", "gradeId", "subjectId"],
  lessons: ["title", "textbookId", "subjectId", "gradeId"],
  "source-documents": ["filename", "originalName", "mimeType", "size", "hash", "storagePath", "processingStatus"],
};
const statuses: Partial<Record<Resource, string[]>> = {
  subjects: ["active", "archived"], grades: ["active", "archived"], textbooks: ["active", "archived"], lessons: ["draft", "processing", "ready", "archived"],
};
const referenceFields = new Set(["subjectId", "gradeId", "textbookId", "lessonId"]);

export function validatePayload(resource: Resource, input: unknown, partial = false) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("JSON object is required");
  const source = input as Record<string, unknown>; const allowed = new Set(fields[resource]);
  const unknown = Object.keys(source).filter((key) => !allowed.has(key));
  if (unknown.length) throw new Error(`Unknown fields: ${unknown.join(", ")}`);
  if (!partial) {
    const missing = required[resource].filter((field) => source[field] === undefined || source[field] === "");
    if (missing.length) throw new Error(`Missing required fields: ${missing.join(", ")}`);
  }
  const output = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== undefined)) as Record<string, unknown>;
  for (const field of referenceFields) if (output[field] !== undefined && !Types.ObjectId.isValid(String(output[field]))) throw new Error(`Invalid ${field}`);
  if (output.name !== undefined && (typeof output.name !== "string" || !output.name.trim())) throw new Error("Name is required");
  if (output.title !== undefined && (typeof output.title !== "string" || !output.title.trim())) throw new Error("Title is required");
  if (output.level !== undefined && (!Number.isInteger(Number(output.level)) || Number(output.level) < 1 || Number(output.level) > 12)) throw new Error("Grade level must be an integer from 1 to 12");
  for (const field of ["order", "level", "lessonNumber", "size", "extractedCharacterCount"]) if (output[field] !== undefined) output[field] = Number(output[field]);
  for (const field of ["objectives", "keyConcepts"]) if (output[field] !== undefined && !Array.isArray(output[field])) throw new Error(`${field} must be an array`);
  if (output.status !== undefined && statuses[resource] && !statuses[resource]?.includes(String(output.status))) throw new Error(`Invalid ${resource} status`);
  if (resource === "subjects" || resource === "lessons") output.slug = output.slug || slugify(String(output.name || output.title || ""));
  return output;
}
