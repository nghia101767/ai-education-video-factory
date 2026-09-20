import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { YouTubeChannel } from "@/models";
import { createOAuthState } from "@/lib/oauth-state";
import { env } from "@/lib/env";

export async function GET() { await connectToDatabase(); return NextResponse.json(await YouTubeChannel.find().select("-accessToken -refreshToken").lean()); }
export async function POST() {
  const state = createOAuthState(); const clientId = process.env.YOUTUBE_CLIENT_ID;
  if (clientId && process.env.YOUTUBE_CLIENT_SECRET && process.env.YOUTUBE_CREDENTIAL_KEY) {
    const redirect = process.env.YOUTUBE_REDIRECT_URI || `${env.appUrl}/api/youtube/oauth/callback`; const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authorizationUrl.searchParams.set("client_id", clientId); authorizationUrl.searchParams.set("redirect_uri", redirect); authorizationUrl.searchParams.set("response_type", "code"); authorizationUrl.searchParams.set("access_type", "offline"); authorizationUrl.searchParams.set("prompt", "consent"); authorizationUrl.searchParams.set("scope", "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly"); authorizationUrl.searchParams.set("state", state);
    return NextResponse.json({ mode: "real", authorizationUrl: authorizationUrl.toString(), state });
  }
  return NextResponse.json({ mode: "mock", configured: false, authorizationUrl: `${env.appUrl}/api/youtube/oauth/callback?state=${state}`, state, message: "MOCK: YouTube credentials are NOT_CONFIGURED; no channel or token will be stored." });
}
