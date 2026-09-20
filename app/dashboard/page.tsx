"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
type Data = { counts: Record<string, number>; costs: { today: number; month: number }; storage: { totalBytes: number }; recentJobs: Array<{ _id: string; status: string; progress: number; currentStep?: string; videoId?: { title?: string } }>; publishingQueued: number };
const bytes = (value: number) => value < 1024 * 1024 ? `${(value / 1024).toFixed(1)} KB` : `${(value / 1024 / 1024).toFixed(1)} MB`;
export default function Dashboard() {
  const [data, setData] = useState<Data | null>(null); const [error, setError] = useState("");
  const load = useCallback(async () => { try { const response = await fetch("/api/dashboard"); const body = await response.json(); if (!response.ok) throw new Error(body.error); setData(body); setError(""); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load dashboard"); } }, []);
  useEffect(() => { void load(); }, [load]);
  return <main className="content"><header><div><p className="eyebrow">WORKSPACE OVERVIEW</p><h1>Dashboard</h1><p className="muted">Live MongoDB, job, AI cost and storage data.</p></div><Link className="primary link-button" href="/dashboard/lessons">Create lesson</Link></header>
    {error && <div className="panel error-state"><p className="error">{error}</p><button onClick={() => void load()}>Retry</button></div>}
    {!data && !error ? <div className="panel"><p className="muted">Loading dashboard...</p></div> : data && <><div className="stats">{[["Subjects", data.counts.subjects], ["Grades", data.counts.grades], ["Textbooks", data.counts.textbooks], ["Lessons", data.counts.lessons], ["Scripts", data.counts.scripts], ["Videos", data.counts.videos], ["Render queue", data.counts.renderJobs], ["Published", data.counts.publishedVideos]].map(([label, value]) => <div className="stat" key={label}><span>{label}</span><strong>{value}</strong><small>MongoDB records</small></div>)}</div>
      <div className="grid"><article className="panel"><h2>AI and storage</h2><div className="metric-list"><p>AI cost today <b>${Number(data.costs.today).toFixed(4)}</b></p><p>AI cost this month <b>${Number(data.costs.month).toFixed(4)}</b></p><p>Storage used <b>{bytes(data.storage.totalBytes)}</b></p><p>Publishing queued <b>{data.publishingQueued}</b></p></div><Link className="link" href="/dashboard/analytics/cost">View cost details →</Link></article><article className="panel"><h2>Recent render jobs</h2>{data.recentJobs.length === 0 ? <div className="empty"><p className="muted">No render jobs yet.</p></div> : data.recentJobs.map((job) => <div className="activity" key={job._id}><i>▶</i><div><b>{job.videoId?.title || "Video render"}</b><p>{job.currentStep || job.status}</p></div><span className="badge">{job.progress}%</span></div>)}<Link className="link" href="/dashboard/render-queue">Open render queue →</Link></article></div></>}
  </main>;
}
