const enabled = (value: string | undefined) => value?.trim().toLowerCase() === "true";

export function isMockAI() { return enabled(process.env.MOCK_AI); }

export function llmConfig() {
  const defaultProvider = process.env.NODE_ENV === "production" ? "openai" : "mock";
  return { provider: isMockAI() ? "mock" : (process.env.AI_LLM_PROVIDER || defaultProvider).toLowerCase(), model: process.env.OPENAI_MODEL || "gpt-4o-mini", timeoutMs: Math.max(1, Number(process.env.AI_TIMEOUT_MS || 30_000)), retryLimit: Math.max(0, Number(process.env.AI_RETRY_LIMIT || 2)), retryBaseMs: Math.max(0, Number(process.env.AI_RETRY_BASE_MS || 1_000)) };
}

export function analysisConfig() {
  const config = llmConfig();
  return { ...config, model: config.provider === "mock" ? "mock-analysis-v1" : process.env.OPENAI_ANALYSIS_MODEL || "gpt-5.6-luna" };
}
export function scriptConfig() {
  const config = llmConfig();
  return { ...config, model: config.provider === "mock" ? "mock-script-v2" : process.env.OPENAI_SCRIPT_MODEL || "gpt-5.6-luna" };
}
export function storyboardConfig() {
  const config = llmConfig();
  return { ...config, model: config.provider === "mock" ? "mock-storyboard-v1" : process.env.OPENAI_STORYBOARD_MODEL || process.env.OPENAI_MODEL || "gpt-5.6-luna" };
}

export function imageConfig() { const provider = isMockAI() ? "mock" : (process.env.IMAGE_PROVIDER || process.env.AI_IMAGE_PROVIDER || "mock").toLowerCase(); const model = provider === "huggingface" ? process.env.HF_IMAGE_MODEL || "black-forest-labs/FLUX.1-schnell" : provider === "gemini" ? process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image" : provider === "mock" ? "mock-image-v1" : process.env.OPENAI_IMAGE_MODEL || "gpt-image-1"; return { provider, model }; }
export function ttsConfig() {
  const provider = isMockAI() ? "mock" : (process.env.TTS_PROVIDER || process.env.AI_TTS_PROVIDER || "mock").toLowerCase();
  return { provider, model: provider === "vieneu" ? "VieNeu-TTS-v3-Turbo-onnx-fp32-sdk3.6.4" : process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts", voice: provider === "vieneu" ? process.env.VIENEU_VOICE || "default" : process.env.OPENAI_TTS_VOICE || "alloy" };
}
