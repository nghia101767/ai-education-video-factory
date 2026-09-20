import { z } from "zod";

export const ANALYSIS_SCHEMA_VERSION = "lesson-analysis-schema-v1";
const text = z.string().trim().min(1);
// Preserve the existing MongoDB and downstream Script contract.
export const lessonAnalysisSchema = z.object({
  sourceSummary: text,
  learningObjectives: z.array(text).min(1),
  keyFacts: z.array(text).min(1),
  definitions: z.array(text),
  formulas: z.array(text),
  examples: z.array(text),
  commonMistakes: z.array(text),
  keywords: z.array(text),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
}).strict();
