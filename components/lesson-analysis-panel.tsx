"use client";
import { useEffect, useState } from "react";
export type Analysis = { _id: string; version: number; provider?: string; model?: string; promptVersion?: string; schemaVersion?: string; sourceSummary: string; learningObjectives: string[]; keyFacts: string[]; definitions: string[]; formulas: string[]; examples: string[]; commonMistakes: string[]; keywords: string[]; difficulty: string; usage?: { inputTokens: number | null; outputTokens: number | null; estimatedCost: number | null }; cached?: boolean };
type Provider = { provider: string; model: string; configured: boolean; runtimeVerified: boolean };
export function LessonAnalysisPanel({ lessonId, analyses, reload }: { lessonId: string; analyses: Analysis[]; reload: () => Promise<void> }) {
  const [provider, setProvider] = useState<Provider | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [result, setResult] = useState("");
  useEffect(() => { void fetch("/api/health/analysis").then(async response => { if (!response.ok) throw new Error(); setProvider(await response.json()); }).catch(() => setError("Không tải được cấu hình AI.")); }, []);
  async function analyze(force: boolean) {
    if (force && !window.confirm("Bỏ qua cache và tạo analysis mới? OpenAI có thể phát sinh chi phí.")) return;
    setBusy(true); setError(""); setResult("");
    try {
      const response = await fetch(`/api/lessons/${lessonId}/analyze`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ force }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "Không thể phân tích bài học.");
      await reload(); setResult(body.cached ? "CACHE HIT — Đã dùng lại analysis." : "CACHE MISS — Đã lưu analysis mới.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể phân tích bài học."); }
    finally { setBusy(false); }
  }
  const current = analyses[0];
  const label = !provider ? "Đang tải cấu hình AI..." : !provider.configured ? "⚠️ AI chưa được cấu hình" : provider.provider === "mock" ? "🧪 Mock" : "✨ OpenAI";
  const lists = current ? [["Mục tiêu học tập", current.learningObjectives], ["Kiến thức trọng tâm", current.keyFacts], ["Định nghĩa", current.definitions], ["Công thức", current.formulas], ["Ví dụ", current.examples], ["Điều học sinh dễ nhầm", current.commonMistakes], ["Từ khóa", current.keywords]] as const : [];
  return <section className="panel" data-testid="lesson-analysis" style={{ marginTop: 24 }}>
    <div className="panel-title"><div><h2>Phân tích bài học</h2><p data-testid="analysis-provider">{label} · {provider?.model}</p></div><div className="button-row">
      <button className="primary" disabled={busy} onClick={() => void analyze(false)}>{current ? "Regenerate analysis" : "Phân tích bài học"}</button>
      {current && <button disabled={busy} onClick={() => void analyze(true)}>Force regenerate</button>}
    </div></div>
    {busy && <p role="status">Đang chờ kết quả phân tích từ server...</p>}
    {result && <p role="status">{result}</p>}
    {error && <p role="alert" className="error">Không thể phân tích bài học. {error}</p>}
    {!current ? <p>Chưa có analysis.</p> : <div data-testid="analysis-result">
      <p>v{current.version} · Kết quả: {current.provider?.startsWith("mock") ? "🧪 Mock" : current.provider === "openai" ? "✨ OpenAI" : current.provider} · {current.model}</p>
      <h3>Tóm tắt</h3><p>{current.sourceSummary}</p>
      <div className="analysis-grid">{lists.map(([title, items]) => <div key={title}><h3>{title}</h3>{items.length ? <ul>{items.map((item, index) => <li key={index}>{item}</li>)}</ul> : <p>Không có thông tin trong nguồn.</p>}</div>)}</div>
      <p>Mức độ: {current.difficulty} · Prompt: {current.promptVersion} · Schema: {current.schemaVersion}</p>
      {current.usage && <p>Input tokens: {current.usage.inputTokens ?? "Không có"} · Output tokens: {current.usage.outputTokens ?? "Không có"} · Chi phí ước tính: {current.usage.estimatedCost == null ? "Chưa cấu hình pricing" : `${current.usage.estimatedCost} USD`}</p>}
    </div>}
    {analyses.length > 1 && <details><summary>Lịch sử ({analyses.length})</summary>{analyses.map(item => <p key={item._id}>v{item.version} · {item.provider} · {item.sourceSummary}</p>)}</details>}
  </section>;
}
