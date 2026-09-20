import { NextResponse } from "next/server"; import { cookies } from "next/headers"; import { authCookieName, getSessionUser } from "@/lib/auth";
export async function GET() { const user = await getSessionUser((await cookies()).get(authCookieName)?.value); return user ? NextResponse.json({ authenticated: true, user }) : NextResponse.json({ authenticated: false }, { status: 401 }); }
