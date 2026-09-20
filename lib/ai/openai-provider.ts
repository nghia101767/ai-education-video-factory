import type { AIProvider, LessonAnalysisOutput, LessonInput, ScriptOutput, ScriptReviewOutput, YouTubeMetadataOutput } from "@/lib/ai/types";
import { parseStructured, validMetadata, validScriptReview } from "@/lib/ai/schemas";
import { requestAnalysis, requestSchemaResponse } from "@/lib/ai/analysis-response";
import { scriptSchema } from "@/lib/ai/script-schema";
import type { AnalysisOptions } from "@/lib/ai/types";
import { scriptGenerationPrompt, SCRIPT_GENERATION_SYSTEM } from "@/lib/ai/prompts/script-generation";
import { scriptValidationPrompt } from "@/lib/ai/prompts/script-validation";
import { llmConfig, scriptConfig, storyboardConfig } from "@/lib/ai/config";
import { storyboardOutputSchema } from "@/lib/ai/storyboard-schema";
import { storyboardGenerationPrompt, STORYBOARD_GENERATION_SYSTEM } from "@/lib/ai/prompts/storyboard-generation";

const endpoint = () => process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const retryable = (status: number) => status === 408 || status === 429 || status >= 500;
export type ProviderUsage = { inputTokens?: number; outputTokens?: number; requestId?: string };

export async function requestStructured<T>(prompt: string, schemaInstruction: string, guard: (value: unknown) => value is T, usage: ProviderUsage): Promise<T> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("LLM provider not configured");
  const config = llmConfig();
  let lastError: unknown;
  for (let attempt = 0; attempt <= config.retryLimit; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const response = await fetch(`${endpoint()}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: config.model, temperature: 0.2, response_format: { type: "json_object" }, messages: [{ role: "system", content: schemaInstruction }, { role: "user", content: prompt }] }),
        signal: controller.signal,
      });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) throw new Error("LLM authentication failed");
        const error = new Error(`LLM request failed (${response.status})`);
        if (!retryable(response.status)) throw error;
        throw error;
      }
      const body = await response.json() as { id?: string; usage?: { prompt_tokens?: number; completion_tokens?: number }; choices?: Array<{ message?: { content?: string } }> };
      usage.requestId = body.id;
      usage.inputTokens = body.usage?.prompt_tokens;
      usage.outputTokens = body.usage?.completion_tokens;
      return parseStructured(body.choices?.[0]?.message?.content || "", guard);
    } catch (error) {
      lastError = error;
      if (error instanceof Error && /authentication|not configured/.test(error.message)) throw error;
      if (attempt >= config.retryLimit) throw error;
      await new Promise((resolve) => setTimeout(resolve, Math.min(30_000, config.retryBaseMs * 2 ** attempt)));
    } finally { clearTimeout(timer); }
  }
  throw lastError instanceof Error ? lastError : new Error("LLM request failed");
}

export class OpenAILLMProvider implements AIProvider {
  name = "openai";
  lastUsage: ProviderUsage = {};
  private async run<T>(prompt: string, schema: string, guard: (value: unknown) => value is T) { this.lastUsage = {}; return requestStructured(prompt, schema, guard, this.lastUsage); }
  analyzeLesson(input: LessonInput, options?: AnalysisOptions): Promise<LessonAnalysisOutput> { return requestAnalysis(input, options); }
  generateScript(input: LessonInput & { analysis: LessonAnalysisOutput; instruction?: string; style?: string }, options?: AnalysisOptions) {
    return requestSchemaResponse({ config: scriptConfig(), system: SCRIPT_GENERATION_SYSTEM, prompt: scriptGenerationPrompt(input), schema: scriptSchema, name: "educational_script", invalidMessage: "Kịch bản AI trả về không hợp lệ." }, options);
  }
  validateScript(input: ScriptOutput) { return this.run<ScriptReviewOutput>(`${scriptValidationPrompt}\n${JSON.stringify(input)}`, "Return exactly: valid (boolean), errors (string[]), warnings (string[]).", validScriptReview); }
  generateStoryboard(input: ScriptOutput & { duration: number; instruction?: string }, options?: AnalysisOptions) {
    return requestSchemaResponse({ config: storyboardConfig(), system: STORYBOARD_GENERATION_SYSTEM, prompt: storyboardGenerationPrompt(input), schema: storyboardOutputSchema, name: "educational_storyboard", invalidMessage: "Storyboard AI trả về không hợp lệ." }, options);
  }
  generateMetadata(input: { lessonTitle: string; script: ScriptOutput }) { return this.run<YouTubeMetadataOutput>(`Tạo metadata YouTube giáo dục: ${JSON.stringify(input)}`, "Return exactly: title, description, tags, hashtags. Title <= 100 characters.", validMetadata); }
}
