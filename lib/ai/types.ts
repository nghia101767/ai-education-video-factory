export type LessonInput = { title: string; summary?: string; objectives?: string[]; keyConcepts?: string[]; chapter?: string; subject?: string; grade?: string; textbook?: string };
export type AnalysisAttempt = { model: string; inputTokens?: number; outputTokens?: number; cachedInputTokens?: number; requestId?: string; durationMs: number; status: "success" | "failed"; error?: string };
export type AnalysisOptions = { beforeAttempt?: () => Promise<void>; onAttempt?: (attempt: AnalysisAttempt) => Promise<void> };
export type LessonAnalysisOutput = { sourceSummary: string; learningObjectives: string[]; keyFacts: string[]; definitions: string[]; formulas: string[]; examples: string[]; commonMistakes: string[]; keywords: string[]; difficulty: "beginner" | "intermediate" | "advanced" };
export type ScriptSceneOutput = { order: number; narration: string; visualDescription: string; duration: number; onScreenText: string };
export type ScriptOutput = { title: string; hook: string; narration: string; conclusion: string; targetAudience: string; educationalGoal: string; callToAction: string; estimatedDuration: number; targetDuration: 30; scenes: ScriptSceneOutput[]; keywords: string[] };
export type ScriptReviewOutput = { valid: boolean; errors: string[]; warnings: string[] };
export type StoryboardSceneOutput = { order: number; startTime: number; endTime: number; duration: number; narration: string; visualDescription: string; camera: string; transition: string; onScreenText: string; assetRequirements: Array<{ type: "image" | "illustration" | "diagram" | "text" | "animation" | "video"; description: string; role: "background" | "subject" | "overlay" | "supporting"; required: boolean }> };
export type StoryboardOutput = { title: string; duration: number; aspectRatio: "9:16"; fps: 30; scenes: StoryboardSceneOutput[] }; 
export type YouTubeMetadataOutput = { title: string; description: string; tags: string[]; hashtags: string[] };
export interface AIProvider {
  name: string;
  analyzeLesson(input: LessonInput, options?: AnalysisOptions): Promise<LessonAnalysisOutput>;
  generateScript(input: LessonInput & { analysis: LessonAnalysisOutput; instruction?: string; style?: string }, options?: AnalysisOptions): Promise<ScriptOutput>;
  validateScript(input: ScriptOutput): Promise<ScriptReviewOutput>;
  generateStoryboard(input: ScriptOutput & { duration: number; instruction?: string }, options?: AnalysisOptions): Promise<StoryboardOutput>;
  generateMetadata(input: { lessonTitle: string; script: ScriptOutput }): Promise<YouTubeMetadataOutput>;
}
