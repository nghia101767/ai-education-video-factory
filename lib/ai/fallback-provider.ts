import type { AIProvider, LessonAnalysisOutput, LessonInput, ScriptOutput } from "@/lib/ai/types";
import { OpenAILLMProvider } from "@/lib/ai/openai-provider";
import { llmConfig } from "@/lib/ai/config";
export class FallbackAIProvider implements AIProvider {
  name = "mock-local";
  async analyzeLesson(input: LessonInput): Promise<LessonAnalysisOutput> { const facts = input.keyConcepts?.length ? input.keyConcepts : [input.summary || `Khái niệm nền tảng của ${input.title}`]; return { sourceSummary: input.summary || input.title, learningObjectives: input.objectives?.length ? input.objectives : [`Hiểu ${input.title}`], keyFacts: facts, definitions: facts.map((fact) => `${fact} là nội dung trọng tâm của bài học.`), formulas: [], examples: input.summary ? [input.summary] : [], commonMistakes: ["Nhầm lẫn giữa khái niệm và ví dụ minh họa"], keywords: [input.title, ...facts].slice(0, 8), difficulty: "beginner" }; }
  async generateScript(input: LessonInput & { analysis: LessonAnalysisOutput }) {
    const hook = "Em hãy cùng khám phá bài học này nhé!";
    const conclusion = "Hãy ghi nhớ ý chính và thử giải thích lại bằng lời của mình.";
    const callToAction = "Cùng luyện tập nhé!";
    const parts = [hook, "Trước hết, chúng ta đọc nội dung bài học và tìm kiến thức quan trọng. Sau đó, em quan sát ví dụ và giải thích từng bước thật rõ ràng.", "Khi gặp điều chưa hiểu, hãy hỏi thầy cô để được hướng dẫn thêm. Em cũng có thể kể lại ví dụ cho bạn nghe bằng câu thật ngắn.", conclusion + " " + callToAction];
    const narration = parts.join(" ");
    return { title: input.title, hook, narration, conclusion, callToAction, targetAudience: "Học sinh (MOCK)", educationalGoal: input.analysis.learningObjectives[0] || input.title, estimatedDuration: 30, targetDuration: 30 as const, keywords: ["MOCK"], scenes: parts.map((text, i) => ({ order: i + 1, narration: text, visualDescription: "MOCK minh họa bài học", duration: 7.5, onScreenText: "MOCK" })) };
  }
  async validateScript() { return { valid: true, errors: [], warnings: ["MOCK validation"] }; }
  async generateStoryboard(input: ScriptOutput & { duration: number }) { const parts = input.scenes?.length ? input.scenes : [{ narration: input.narration }]; const chunk = input.duration / parts.length; return { title: input.title, duration: input.duration, aspectRatio: "9:16" as const, fps: 30 as const, scenes: parts.map((part, index) => { const startTime = Number((index * chunk).toFixed(2)); const endTime = index === parts.length - 1 ? input.duration : Number(((index + 1) * chunk).toFixed(2)); return { order: index + 1, startTime, endTime, duration: Number((endTime - startTime).toFixed(2)), narration: part.narration, visualDescription: `MOCK kế hoạch hình ảnh giáo dục cụ thể cho ${input.title}, cảnh ${index + 1}`, camera: "Khung dọc trung cảnh, máy quay tĩnh", transition: index ? "Cắt nhanh" : "Mở đầu trực tiếp", onScreenText: `Ý chính ${index + 1}`, assetRequirements: [{ type: "illustration" as const, description: `Minh họa dọc cho cảnh ${index + 1}: ${part.narration}`, role: "subject" as const, required: true }] }; }) }; }
  async generateMetadata(input: { lessonTitle: string; script: ScriptOutput }) { return { title: input.lessonTitle.slice(0, 100), description: input.script.educationalGoal, tags: [input.lessonTitle, "giáo dục"], hashtags: ["#giáodục"] }; }
}
export const aiProvider: AIProvider = llmConfig().provider === "openai" ? new OpenAILLMProvider() : new FallbackAIProvider();
