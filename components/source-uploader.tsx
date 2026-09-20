"use client";
import { useCallback, useEffect, useState } from "react";
type Document = { _id: string; originalName: string; mimeType: string; size: number; processingStatus: string; extractedCharacterCount?: number; lessonId?: { _id: string; title: string } };
type Lesson = { _id: string; title: string };
export function SourceUploader({ lessonId: fixedLessonId, onUploaded }: { lessonId?: string; onUploaded?: () => void }) {
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const [lessonId, setLessonId] = useState(fixedLessonId || ""); const [lessons, setLessons] = useState<Lesson[]>([]);
  useEffect(() => { if (fixedLessonId) return; void fetch("/api/content/lessons").then((r) => r.json()).then((data) => setLessons(data.items || [])).catch(() => setMessage("Unable to load lessons")); }, [fixedLessonId]);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setMessage(""); const form = event.currentTarget; const data = new FormData(form); if (lessonId) data.set("lessonId", lessonId);
    try { const response = await fetch("/api/content/source-documents/upload", { method: "POST", body: data }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setMessage(`Uploaded ${result.originalName} · ${result.processingStatus}`); form.reset(); onUploaded?.(); } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Upload failed"); } finally { setBusy(false); }
  };
  return <form className="panel form" onSubmit={submit}><h2>Upload source document</h2><p className="muted">PDF, DOCX, TXT, PNG, JPG or JPEG · maximum 50 MB</p>{!fixedLessonId && <select required value={lessonId} onChange={(e) => setLessonId(e.target.value)}><option value="">Select lesson</option>{lessons.map((lesson) => <option key={lesson._id} value={lesson._id}>{lesson.title}</option>)}</select>}<input required type="file" name="file" accept=".pdf,.docx,.txt,.png,.jpg,.jpeg"/><button className="primary" disabled={busy} type="submit">{busy ? "Uploading and extracting..." : "Upload document"}</button>{message && <p className={message.includes("Uploaded") ? "success" : "error"}>{message}</p>}</form>;
}

export function SourceDocumentList({ lessonId }: { lessonId?: string }) {
  const [documents, setDocuments] = useState<Document[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [reload, setReload] = useState(0);
  const load = useCallback(async () => { setLoading(true); try { const query = lessonId ? `?lessonId=${lessonId}` : ""; const response = await fetch(`/api/content/source-documents${query}`); const body = await response.json(); if (!response.ok) throw new Error(body.error); setDocuments(body.items || []); setError(""); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load documents"); } finally { setLoading(false); } }, [lessonId]);
  useEffect(() => { void load(); }, [load, reload]);
  return <section><SourceUploader lessonId={lessonId} onUploaded={() => setReload((value) => value + 1)} /><div className="panel table-panel" style={{ marginTop: 20 }}><h2>Documents</h2>{error && <p className="error">{error}</p>}{loading ? <p className="muted">Loading...</p> : documents.length === 0 ? <p className="muted">No source documents attached.</p> : <table><thead><tr><th>File</th><th>Lesson</th><th>Extraction</th><th>Size</th></tr></thead><tbody>{documents.map((document) => <tr key={document._id}><td><b>{document.originalName}</b><small>{document.mimeType}</small></td><td>{document.lessonId?.title || "Unassigned"}</td><td><span className="badge">{document.processingStatus}</span><small>{document.extractedCharacterCount || 0} characters</small></td><td>{(document.size / 1024).toFixed(1)} KB</td></tr>)}</tbody></table>}</div></section>;
}
