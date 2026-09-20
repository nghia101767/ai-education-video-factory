import { getEncoding } from "js-tiktoken";
import { AnalysisError } from "@/lib/ai/analysis-response";
import { LESSON_ANALYSIS_SYSTEM, lessonAnalysisPrompt } from "@/lib/ai/prompts/lesson-analysis";
import type { LessonInput } from "@/lib/ai/types";

export function normalizeLessonText(raw: string) {
  const pages = raw.replace(/\r\n?/g, "\n").split("\f").map(page => page.split("\n").map(line => line.replace(/[\t ]+/g, " ").trim()));
  const seen = new Set<string>();
  const boundaryCounts = new Map<string, number>();
  for (const page of pages) for (const line of new Set([page[0], page[page.length - 1]])) boundaryCounts.set(line, (boundaryCounts.get(line) || 0) + 1);
  // Deduplicate only repeated page-boundary headers/footers, keeping the first.
  return pages.map(lines => lines.filter((line, index) => {
    if (!line || line.length > 120 || (index !== 0 && index !== lines.length - 1)) return true;
    const repeated = (boundaryCounts.get(line) || 0) > 1;
    if (!repeated) return true;
    if (seen.has(line)) return false;
    seen.add(line); return true;
  }).join("\n")).join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}
let tokenizer: ReturnType<typeof getEncoding> | undefined;
export function validateAnalysisSize(input: LessonInput) {
  const prompt = LESSON_ANALYSIS_SYSTEM + "\n" + lessonAnalysisPrompt(input);
  if (prompt.length > 250000) throw new AnalysisError("ANALYSIS_INPUT_TOO_LARGE", "Nội dung quá dài. Hãy chia thành các bài học nhỏ hơn; hệ thống không cắt bỏ nguồn.", 413);
  tokenizer ||= getEncoding("o200k_base");
  const tokens = tokenizer.encode(prompt).length;
  if (tokens > 32000) throw new AnalysisError("ANALYSIS_INPUT_TOO_LARGE", "Nội dung vượt giới hạn 32.000 token ước lượng. Hãy chia thành các bài học nhỏ hơn.", 413);
  return tokens;
}
