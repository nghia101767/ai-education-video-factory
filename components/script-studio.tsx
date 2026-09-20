"use client";
import { useCallback, useEffect, useState } from "react";
import type { GeneratedScript } from "@/lib/ai/script-schema";
type Script = Partial<GeneratedScript> & { _id: string; analysisId?: string; title: string; hook: string; narration: string; callToAction: string; duration: number; wordCount: number; status: string; version: number; provider?: string; model?: string; requestedModel?: string; promptVersion?: string; schemaVersion?: string; style?: "clear" | "engaging" | "storytelling"; cached?: boolean; updatedAt: string };
type Config = { provider: string; model: string; configured: boolean; runtimeVerified: boolean; promptVersion: string; schemaVersion: string };
export function ScriptStudio({ lessonId, analysisReady }: { lessonId: string; analysisReady?: boolean }) {
  const [scripts, setScripts] = useState<Script[]>([]), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState(false), [editing, setEditing] = useState<Script | null>(null), [config, setConfig] = useState<Config | null>(null), [instruction, setInstruction] = useState(""), [style, setStyle] = useState<"clear" | "engaging" | "storytelling">("engaging");
  const load = useCallback(async () => {
    const response = await fetch(`/api/lessons/${lessonId}/scripts`);
    const body = await response.json(); if (!response.ok) throw new Error(body.error); setScripts(body);
  }, [lessonId]);
  useEffect(() => { void load().catch(() => { setError(true); setMessage("Không tải được kịch bản."); }); void fetch("/api/health/script").then(r => r.json()).then(setConfig).catch(() => setConfig(null)); }, [load]);
  const run = async (work: () => Promise<void>) => { if (busy) return; setBusy(true); setMessage(""); setError(false); try { await work(); } catch (cause) { setError(true); setMessage(cause instanceof Error ? cause.message : "Yêu cầu thất bại."); } finally { setBusy(false); } };
  const json = async (url: string, method: string, input?: unknown) => { const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, ...(input ? { body: JSON.stringify(input) } : {}) }); const body = await response.json(); if (!response.ok) throw new Error([body.error, ...(body.details || [])].join(" ")); return body; };
  const generate = () => run(async () => {
    const data = await json(`/api/lessons/${lessonId}/scripts/generate`, "POST", { instruction, style });
    setMessage(data.cached ? "CACHE HIT — dùng lại kịch bản, không gọi AI." : "Đã tạo kịch bản."); await load();
  });
  const regenerate = (id: string) => run(async () => {
    if (!window.confirm("Tạo phiên bản mới bằng OpenAI? Thao tác này bỏ qua cache và có thể phát sinh chi phí.")) return;
    await json(`/api/scripts/${id}/regenerate`, "POST", { instruction, style }); setMessage("Đã tạo phiên bản kịch bản mới."); await load();
  });
  const action = (id: string, path: string) => run(async () => { await json(`/api/scripts/${id}/${path}`, "POST"); setMessage(path === "approve" ? "Đã duyệt kịch bản." : "Đã từ chối kịch bản."); await load(); });
  const save = () => run(async () => {
    if (!editing) return;
    const keys = ["title", "hook", "narration", "callToAction", "targetAudience", "educationalGoal", ...(editing.scenes?.length ? ["conclusion", "estimatedDuration", "targetDuration", "scenes", "keywords"] : [])];
    await json(`/api/scripts/${editing._id}/save`, "POST", Object.fromEntries(keys.map(key => [key, editing[key as keyof Script]])));
    setEditing(null); setMessage("Đã lưu. Kịch bản trở về Draft, cần duyệt lại."); await load();
  });
  return <section className="panel script-studio" data-testid="script-studio" style={{ marginTop: 24 }}>
    <div className="panel-title"><div><h2>7. Tạo kịch bản</h2><p data-testid="script-provider">{!config ? "Đang kiểm tra provider..." : !config.configured ? "⚠️ OpenAI chưa được cấu hình." : config.provider === "openai" ? `${config.runtimeVerified ? "✨ OpenAI đã chạy thực tế" : "OpenAI đã cấu hình"} · ${config.model}` : "🧪 Mock (dev/test)"}</p><p className="muted">Dùng LessonAnalysis hiện có · 25–35 giây · không tạo storyboard.</p></div>
    <button className="primary" disabled={busy || !analysisReady || !config?.configured} onClick={() => void generate()}>{busy ? `Đang xử lý bằng ${config?.provider === "openai" ? "OpenAI" : "Mock"}...` : scripts.length ? "Regenerate script" : "Generate script"}</button></div>
    <label>Yêu cầu chỉnh giọng văn (tùy chọn)<input aria-label="Generation instruction" maxLength={1000} value={instruction} disabled={busy} onChange={e => setInstruction(e.target.value)}/></label>
    <label>Phong cách<select aria-label="Script style" value={style} disabled={busy} onChange={e => setStyle(e.target.value as typeof style)}><option value="engaging">Hấp dẫn</option><option value="clear">Rõ ràng</option><option value="storytelling">Kể chuyện</option></select></label>
    {!analysisReady && <p>Cần phân tích bài học trước khi tạo kịch bản.</p>}
    {message && <p role={error ? "alert" : "status"} className={error ? "error" : "success"}>{message}</p>}
    {editing && <div className="editor panel" data-testid="script-editor"><h3>Edit script v{editing.version}</h3>
      {(["title", "hook", "narration", "conclusion", "callToAction"] as const).filter(key => editing[key] !== undefined).map(key => <label key={key}>{key}<textarea aria-label={key} rows={key === "narration" ? 5 : 2} value={editing[key] || ""} onChange={e => setEditing({ ...editing, [key]: e.target.value })}/></label>)}
      {editing.scenes?.length ? <><p>Narration chứa toàn bộ lời đọc. Khi sửa lời đọc, hãy cập nhật các đoạn cảnh tương ứng; tổng thời lượng phải khớp.</p><label>Estimated duration<input aria-label="Estimated duration" type="number" min={25} max={35} step={0.1} value={editing.estimatedDuration} onChange={e => setEditing({ ...editing, estimatedDuration: Number(e.target.value) })}/></label>
      {editing.scenes.map((scene, index) => <fieldset key={scene.order}><legend>Cảnh {scene.order}</legend>{(["narration", "visualDescription", "onScreenText", "duration"] as const).map(key => <label key={key}>{key}<input aria-label={`Scene ${scene.order} ${key}`} type={key === "duration" ? "number" : "text"} step={key === "duration" ? 0.1 : undefined} value={scene[key]} onChange={e => setEditing({ ...editing, scenes: editing.scenes!.map((item, i) => i === index ? { ...item, [key]: key === "duration" ? Number(e.target.value) : e.target.value } : item) })}/></label>)}</fieldset>)}</> : null}
      <button className="primary" disabled={busy} onClick={() => void save()}>Save</button><button disabled={busy} onClick={() => setEditing(null)}>Cancel</button></div>}
    {scripts.map(script => <article className="script-card" data-testid="script-card" data-script-id={script._id} key={script._id}><div><h3>{script.title}</h3><span className="badge">{script.status}</span>
      <p><b>Hook:</b> {script.hook}</p><p><b>Narration:</b> {script.narration}</p><p><b>Conclusion:</b> {script.conclusion || script.callToAction}</p><p><b>CTA:</b> {script.callToAction}</p>
      {script.scenes?.map(scene => <div key={scene.order}><b>Cảnh {scene.order} · {scene.duration}s</b><p>{scene.narration}</p><p>{scene.visualDescription}</p><small>{scene.onScreenText}</small></div>)}
      <p>Keywords: {script.keywords?.join(", ")}</p><p className="muted">v{script.version} · analysis {script.analysisId} · {script.provider === "openai" ? "✨ OpenAI" : script.provider} · actual {script.model} · requested {script.requestedModel} · {script.promptVersion} · {script.schemaVersion} · style {script.style || "engaging"} · {new Date(script.updatedAt).toLocaleString()}</p>
      </div><aside><b>{script.wordCount} âm tiết</b><small>{script.estimatedDuration || script.duration}s estimated / target {script.targetDuration || 30}s</small>
      <button disabled={busy} onClick={() => setEditing(structuredClone(script))}>Edit</button><button disabled={busy} onClick={() => void regenerate(script._id)}>Regenerate</button><button disabled={busy || script.status === "approved"} onClick={() => void action(script._id, "approve")}>Approve</button><button disabled={busy || script.status === "rejected"} onClick={() => void action(script._id, "reject")}>Reject</button>
      {script.status === "approved" && <p>Sẵn sàng cho Storyboard (chưa tạo).</p>}</aside></article>)}
  </section>;
}
