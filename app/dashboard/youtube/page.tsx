"use client";
import { useEffect, useState } from "react";
type Channel = { _id: string; channelName: string; status: string };
export default function Page() {
  const [channels, setChannels] = useState<Channel[]>([]); const [message, setMessage] = useState("");
  const load = () => fetch("/api/youtube/channels").then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error); setChannels(body); }).catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load channels"));
  useEffect(() => { void load(); }, []);
  const connect = async () => { const response = await fetch("/api/youtube/channels", { method: "POST" }); const data = await response.json(); if (!response.ok) return setMessage(data.error || "Unable to start OAuth"); if (data.mode === "real" && data.authorizationUrl) window.location.assign(data.authorizationUrl); else setMessage(data.message || "YouTube is NOT_CONFIGURED."); };
  return <main className="content"><p className="eyebrow">PUBLISHING</p><h1>YouTube channels</h1><p className="muted">Real OAuth opens Google only when credentials are configured. Mock mode never stores a channel or token.</p><button className="primary" onClick={() => void connect()}>Connect YouTube</button>{message && <p className={/not_configured|unable|error/i.test(message) ? "error" : "muted"}>{message}</p>}<div className="panel" style={{ marginTop: 24 }}>{channels.length ? channels.map((channel) => <p key={channel._id}><b>{channel.channelName}</b> · <span className="badge">{channel.status}</span></p>) : <p className="muted">No connected channels.</p>}</div></main>;
}
