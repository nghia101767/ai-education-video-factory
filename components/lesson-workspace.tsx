"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ScriptStudio } from "@/components/script-studio";
import { SourceDocumentList } from "@/components/source-uploader";
import { LessonAnalysisPanel, type Analysis } from "@/components/lesson-analysis-panel";
type Lesson = { _id: string; title: string; status: string; summary?: string; objectives?: string[]; keyConcepts?: string[]; subjectId?: { name?: string }; gradeId?: { name?: string }; textbookId?: { name?: string } };
export function LessonWorkspace({ lessonId }: { lessonId: string }) {
  const [lesson, setLesson] = useState<Lesson | null>(null); const [analyses, setAnalyses] = useState<Analysis[]>([]); const [error, setError] = useState("");
  const load = useCallback(async () => { try { const [lessonResponse, analysisResponse] = await Promise.all([fetch(`/api/content/lessons/${lessonId}`), fetch(`/api/lessons/${lessonId}/analyze`)]); const lessonBody = await lessonResponse.json(); const analysisBody = await analysisResponse.json(); if (!lessonResponse.ok) throw new Error(lessonBody.error); if (!analysisResponse.ok) throw new Error(analysisBody.error); setLesson(lessonBody); setAnalyses(analysisBody); setError(""); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load lesson"); } }, [lessonId]);
  useEffect(() => { void load(); }, [load]);
  if (!lesson) return <main className="content"><p className={error ? "error" : "muted"}>{error || "Loading lesson..."}</p></main>;
  const current = analyses[0];
  return <main className="content detail"><Link className="link" href="/dashboard/lessons">← Lessons</Link><p className="eyebrow">LESSON DETAIL</p><div className="panel-title"><div><h1>{lesson.title}</h1><p className="muted">{lesson.subjectId?.name} · {lesson.gradeId?.name} · {lesson.textbookId?.name}</p></div><span className="badge">{lesson.status}</span></div>{error && <p className="error">{error}</p>}
    <div className="detail-grid"><article className="panel"><h2>Information</h2><p>{lesson.summary || "No summary yet."}</p><h3>Objectives</h3><ul>{lesson.objectives?.length ? lesson.objectives.map((item) => <li key={item}>{item}</li>) : <li className="muted">No objectives</li>}</ul><h3>Key concepts</h3><div className="chips">{lesson.keyConcepts?.map((item) => <span key={item}>{item}</span>)}</div></article><article className="panel"><h2>Pipeline</h2><div className="pipeline"><div>{lesson ? "✓" : "○"} Lesson</div><div>{current ? "✓" : "○"} Analysis</div><div>○ Script approval</div><div>○ Storyboard and assets</div><div>○ Voice, subtitle and render</div><div>○ Video approval</div></div></article></div>
    <section style={{ marginTop: 24 }}><SourceDocumentList lessonId={lessonId} /></section>
    <LessonAnalysisPanel lessonId={lessonId} analyses={analyses} reload={load}/>
    <ScriptStudio lessonId={lessonId} analysisReady={Boolean(current)} />
  </main>;
}
