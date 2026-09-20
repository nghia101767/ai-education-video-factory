import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { YouTubeChannel } from "@/models";
import { encryptCredential } from "@/lib/credentials";
import { validateOAuthState } from "@/lib/oauth-state";
import { env } from "@/lib/env";

export async function GET(request: Request) {
  const url = new URL(request.url); const state = url.searchParams.get("state") || "";
  if (!validateOAuthState(state)) return NextResponse.json({ error: "Invalid OAuth state" }, { status: 400 });
  const code = url.searchParams.get("code");
  if (!code || !process.env.YOUTUBE_CLIENT_ID || !process.env.YOUTUBE_CLIENT_SECRET || !process.env.YOUTUBE_CREDENTIAL_KEY) return NextResponse.json({ connected: false, mode: "mock", code: "NOT_CONFIGURED", message: "MOCK: no YouTube account or token was stored." });
  await connectToDatabase(); let channelId = ""; let channelName = ""; let accessToken = ""; let refreshToken = ""; let tokenExpiry = new Date(Date.now() + 3600000); const provider = "youtube";
  if (code && process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET) {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: process.env.YOUTUBE_CLIENT_ID, client_secret: process.env.YOUTUBE_CLIENT_SECRET, redirect_uri: process.env.YOUTUBE_REDIRECT_URI || `${env.appUrl}/api/youtube/oauth/callback`, grant_type: "authorization_code" }) });
    if (!tokenResponse.ok) return NextResponse.json({ error: "YouTube token exchange failed" }, { status: 502 }); const tokens = await tokenResponse.json() as { access_token?: string; refresh_token?: string; expires_in?: number }; if (!tokens.access_token) return NextResponse.json({ error: "YouTube returned no access token" }, { status: 502 }); accessToken = tokens.access_token; refreshToken = tokens.refresh_token || "";
    const channelResponse = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", { headers: { Authorization: `Bearer ${accessToken}` } }); if (!channelResponse.ok) return NextResponse.json({ error: "YouTube channel verification failed" }, { status: 502 }); const channelBody = await channelResponse.json() as { items?: Array<{ id?: string; snippet?: { title?: string } }> }; const item = channelBody.items?.[0]; if (!item?.id) return NextResponse.json({ error: "No YouTube channel found" }, { status: 400 }); channelId = item.id; channelName = item.snippet?.title || "YouTube Channel";
    tokenExpiry = new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000);
  }
  await YouTubeChannel.findOneAndUpdate({ channelId }, { channelId, channelName, accessToken: encryptCredential(accessToken), refreshToken: encryptCredential(refreshToken), tokenExpiry, status: "connected", metadata: { provider } }, { new: true, upsert: true, setDefaultsOnInsert: true }); return NextResponse.redirect(new URL("/dashboard/youtube?connected=1", env.appUrl));
}
