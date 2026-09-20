"use client";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Resource = "subjects" | "grades" | "textbooks" | "lessons";
type Item = Record<string, unknown> & { _id: string };
type Option = { _id: string; name?: string; title?: string; level?: number; subjectId?: { _id?: string } | string; gradeId?: { _id?: string } | string };
const labels: Record<Resource, string> = { subjects: "Subjects", grades: "Grades", textbooks: "Textbooks", lessons: "Lessons" };
const statuses: Record<Resource, string[]> = { subjects: ["active", "archived"], grades: ["active", "archived"], textbooks: ["active", "archived"], lessons: ["draft", "processing", "ready", "archived"] };
const idOf = (value: unknown) => typeof value === "object" && value ? String((value as { _id?: unknown })._id || "") : String(value || "");
const labelOf = (value: unknown) => typeof value === "object" && value ? String((value as { name?: unknown; title?: unknown }).name || (value as { title?: unknown }).title || "") : "";

export function ContentManager({ resource }: { resource: Resource }) {
  const [items, setItems] = useState<Item[]>([]); const [search, setSearch] = useState(""); const [status, setStatus] = useState("");
  const [page, setPage] = useState(1); const [pages, setPages] = useState(1); const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const [success, setSuccess] = useState("");
  const [form, setForm] = useState<Record<string, string>>({ status: resource === "lessons" ? "draft" : "active" });
  const [editingId, setEditingId] = useState(""); const [confirmDelete, setConfirmDelete] = useState("");
  const [subjects, setSubjects] = useState<Option[]>([]); const [grades, setGrades] = useState<Option[]>([]); const [textbooks, setTextbooks] = useState<Option[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) }); if (search) params.set("search", search); if (status) params.set("status", status);
      const response = await fetch(`/api/content/${resource}?${params}`); const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load");
      setItems(data.items); setPages(Math.max(1, data.pagination.pages)); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load"); } finally { setLoading(false); }
  }, [page, resource, search, status]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (resource !== "textbooks" && resource !== "lessons") return;
    const get = (name: Resource, setter: (items: Option[]) => void) => fetch(`/api/content/${name}`).then((r) => r.json()).then((data) => setter(data.items || []));
    void Promise.all([get("subjects", setSubjects), get("grades", setGrades), ...(resource === "lessons" ? [get("textbooks", setTextbooks)] : [])]).catch(() => setError("Unable to load reference data"));
  }, [resource]);
  useEffect(() => { setPage(1); }, [search, status]);

  const availableTextbooks = useMemo(() => textbooks.filter((book) => (!form.subjectId || idOf(book.subjectId) === form.subjectId) && (!form.gradeId || idOf(book.gradeId) === form.gradeId)), [form.gradeId, form.subjectId, textbooks]);
  const reset = () => { setEditingId(""); setForm({ status: resource === "lessons" ? "draft" : "active" }); };
  const payload = () => {
    const data: Record<string, unknown> = { ...form };
    for (const key of ["level", "order", "lessonNumber"]) if (form[key]) data[key] = Number(form[key]); else delete data[key];
    for (const key of ["objectives", "keyConcepts"]) data[key] = (form[key] || "").split(",").map((item) => item.trim()).filter(Boolean);
    return data;
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(""); setSuccess("");
    try {
      const response = await fetch(`/api/content/${resource}${editingId ? `/${editingId}` : ""}`, { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload()) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Save failed");
      setSuccess(editingId ? "Updated successfully." : "Created successfully."); reset(); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Save failed"); } finally { setSaving(false); }
  };
  const edit = (item: Item) => {
    const next: Record<string, string> = {};
    for (const [key, value] of Object.entries(item)) {
      if (["_id", "__v", "createdAt", "updatedAt", "sourceDocumentIds"].includes(key)) continue;
      next[key] = Array.isArray(value) ? value.join(", ") : ["subjectId", "gradeId", "textbookId"].includes(key) ? idOf(value) : typeof value === "object" ? "" : String(value ?? "");
    }
    setEditingId(item._id); setForm(next); setSuccess(""); window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const remove = async (id: string) => {
    if (confirmDelete !== id) { setConfirmDelete(id); return; }
    const response = await fetch(`/api/content/${resource}/${id}`, { method: "DELETE" }); const data = await response.json();
    if (!response.ok) setError(data.error || "Delete failed"); else { setSuccess("Deleted successfully."); setConfirmDelete(""); await load(); }
  };

  const set = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  return <main className="content manager">
    <div className="manager-head"><div><p className="eyebrow">CONTENT LIBRARY</p><h1>{labels[resource]}</h1><p className="muted">Real MongoDB records with validated create, edit and safe delete.</p></div><div className="filters"><input aria-label="Search" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} /><select aria-label="Filter status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{statuses[resource].map((value) => <option key={value}>{value}</option>)}</select></div></div>
    <div className="manager-grid"><form className="panel form" onSubmit={submit}><h2>{editingId ? "Edit" : "Add"} {labels[resource].slice(0, -1).toLowerCase()}</h2>
      <input required placeholder={resource === "lessons" ? "Lesson title" : "Name"} value={form.name || form.title || ""} onChange={(e) => set(resource === "lessons" ? "title" : "name", e.target.value)} />
      {resource === "grades" && <input required type="number" min="1" max="12" placeholder="Level" value={form.level || ""} onChange={(e) => set("level", e.target.value)} />}
      {(resource === "textbooks" || resource === "lessons") && <><select required value={form.subjectId || ""} onChange={(e) => set("subjectId", e.target.value)}><option value="">Select subject</option>{subjects.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select><select required value={form.gradeId || ""} onChange={(e) => set("gradeId", e.target.value)}><option value="">Select grade</option>{grades.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></>}
      {resource === "textbooks" && <><input placeholder="Publisher" value={form.publisher || ""} onChange={(e) => set("publisher", e.target.value)} /><input placeholder="Edition" value={form.edition || ""} onChange={(e) => set("edition", e.target.value)} /></>}
      {resource === "lessons" && <><select required value={form.textbookId || ""} onChange={(e) => { const selected = textbooks.find((item) => item._id === e.target.value); setForm((current) => ({ ...current, textbookId: e.target.value, ...(selected ? { subjectId: idOf(selected.subjectId), gradeId: idOf(selected.gradeId) } : {}) })); }}><option value="">Select textbook</option>{availableTextbooks.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select><input placeholder="Chapter" value={form.chapter || ""} onChange={(e) => set("chapter", e.target.value)} /><input type="number" min="1" placeholder="Lesson number" value={form.lessonNumber || ""} onChange={(e) => set("lessonNumber", e.target.value)} /><input placeholder="Objectives, comma separated" value={form.objectives || ""} onChange={(e) => set("objectives", e.target.value)} /><input placeholder="Key concepts, comma separated" value={form.keyConcepts || ""} onChange={(e) => set("keyConcepts", e.target.value)} /></>}
      <textarea placeholder="Description / summary" value={form.description || form.summary || ""} onChange={(e) => set(resource === "lessons" ? "summary" : "description", e.target.value)} />
      <select value={form.status || statuses[resource][0]} onChange={(e) => set("status", e.target.value)}>{statuses[resource].map((value) => <option key={value}>{value}</option>)}</select>
      <div className="button-row"><button className="primary" disabled={saving} type="submit">{saving ? "Saving..." : editingId ? "Save changes" : "Create"}</button>{editingId && <button type="button" onClick={reset}>Cancel</button>}</div>
      {error && <p className="error" role="alert">{error}</p>}{success && <p className="success">{success}</p>}
    </form>
    <div className="panel table-panel">{loading ? <p className="muted">Loading...</p> : items.length === 0 ? <div className="empty"><strong>No {labels[resource].toLowerCase()} found</strong><p className="muted">Create the first record or change the filters.</p></div> : <table><thead><tr><th>Name</th><th>Relations</th><th>Status</th><th>Actions</th></tr></thead><tbody>{items.map((item) => <tr key={item._id}><td><b>{resource === "lessons" ? <Link href={`/dashboard/lessons/${item._id}`}>{String(item.title)}</Link> : String(item.name)}</b><small>{resource === "grades" ? `Level ${item.level}` : String(item.publisher || item.chapter || item.slug || "")}</small></td><td><small>{[labelOf(item.subjectId), labelOf(item.gradeId), labelOf(item.textbookId)].filter(Boolean).join(" · ") || "—"}</small></td><td><span className="badge">{String(item.status || "active")}</span></td><td><div className="button-row"><button onClick={() => edit(item)}>Edit</button><button className="delete" onClick={() => void remove(item._id)}>{confirmDelete === item._id ? "Confirm delete" : "Delete"}</button></div></td></tr>)}</tbody></table>}
      <div className="pagination"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page} / {pages}</span><button disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>Next</button></div>
    </div></div>
  </main>;
}
