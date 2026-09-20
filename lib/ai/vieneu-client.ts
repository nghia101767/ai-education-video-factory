export type VieNeuHealth = { status: string; provider: string; available: boolean; model: string; backend: string; sampleRate?: number; startupMs?: number; voices?: Array<{ id: string; label: string }>; error?: string };
class VieNeuClient {
  async request<T>(input: Record<string, unknown>): Promise<T> {
    const base = process.env.VIENEU_TTS_URL || "http://tts:8000";
    const health = input.operation === "health";
    let response: Response;
    try {
      response = await fetch(new URL(health ? "/health" : "/generate", base), {
        method: health ? "GET" : "POST",
        headers: { "Content-Type": "application/json" },
        ...(health ? {} : { body: JSON.stringify(input) }),
        signal: AbortSignal.timeout(health ? 5000 : Number(process.env.VIENEU_TIMEOUT_MS || 900000)),
        cache: "no-store",
      });
    } catch { throw new Error("TTS_PROCESS_ERROR: VieNeu service unreachable or timed out"); }
    const data = await response.json();
    if (!response.ok) {
      const code = typeof data.code === "string" && /^[A-Z_]+$/.test(data.code) ? data.code : response.status >= 500 ? "TTS_PROCESS_ERROR" : "TTS_INVALID_INPUT";
      throw new Error(code + ": " + (typeof data.error === "string" ? data.error : "VieNeu request failed"));
    }
    return data as T;
  }
}
export const vieneuClient = new VieNeuClient();
