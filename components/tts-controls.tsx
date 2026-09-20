"use client";
import { useCallback, useEffect, useState } from "react";
type Job = { _id: string; status: string; error?: string; payload?: { voice?: string } };
type Voice = { id: string; label: string };
export function TTSControls({ scriptId, onComplete }: { scriptId: string; onComplete?: () => Promise<void> }) {
  const [voices, setVoices] = useState<Voice[]>([]); const [voice, setVoice] = useState("default");
  const [provider, setProvider] = useState(""); const [job, setJob] = useState<Job | null>(null);
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    const response = await fetch(`/api/scripts/${scriptId}/audio`);
    if (response.ok) setJob((await response.json()).job);
  }, [scriptId]);
  useEffect(() => {
    let disposed = false;
    void Promise.all([fetch("/api/tts/voices"), fetch(`/api/scripts/${scriptId}/audio`)]).then(async ([response, jobResponse]) => {
      const [data, latest] = await Promise.all([response.json(), jobResponse.json()]);
      if (disposed) return;
      setProvider(data.provider);
      if (jobResponse.ok) setJob(latest.job);
      if (!response.ok) { setMessage(data.error || "VieNeu unavailable"); return; }
      const options: Voice[] = data.voices || [];
      const saved = latest.job?.payload?.voice;
      setVoices(options); setVoice(options.some(item => item.id === saved) ? saved : options[0]?.id || "default");
    }).catch(() => { if (!disposed) setMessage("Unable to load voices or TTS status"); });
    return () => { disposed = true; };
  }, [scriptId]);
  const active = job && ["queued", "processing", "cancellation_requested"].includes(job.status);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => { void refresh(); }, 2000); return () => clearInterval(timer);
  }, [active, refresh]);
  useEffect(() => { if (job?.status === "completed") void onComplete?.(); }, [job?.status, onComplete]);
  async function generate(force: boolean) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/scripts/${scriptId}/audio`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voice, force }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error);
      setJob({ _id: body.jobId, status: body.status });
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to queue voice"); } finally { setBusy(false); }
  }
  async function action(action: "cancel" | "retry") {
    if (!job) return; setBusy(true);
    try {
      const response = await fetch(`/api/jobs/${job._id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error); setJob(data);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Job action failed"); } finally { setBusy(false); }
  }
  return <section className="panel"><h2>Voice · {provider === "vieneu" ? "VieNeu-TTS" : provider}</h2>
    <div className="button-row"><label>Voice <select aria-label="Voice" value={voice} disabled={busy || Boolean(active)} onChange={event => setVoice(event.target.value)}>{voices.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <button disabled={busy || Boolean(active)} onClick={() => void generate(false)}>Generate/reuse voice</button>
      <button disabled={busy || Boolean(active)} onClick={() => void generate(true)}>Regenerate voice</button>
      {active && <button disabled={busy} onClick={() => void action("cancel")}>Cancel TTS</button>}
      {job && ["failed", "cancelled"].includes(job.status) && <button disabled={busy} onClick={() => void action("retry")}>Retry TTS</button>}
    </div>
    {job && <p role="status">{active ? "Generating..." : job.status === "completed" ? "Voice ready. Audio and subtitles updated." : job.status}</p>}
    {(message || job?.error) && <p className="error">{message || job?.error}</p>}
  </section>;
}
