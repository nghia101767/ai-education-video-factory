import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";
const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET || "change-this-session-secret-in-production");
export async function signSession(userId: string, expiresAt: Date) { return new SignJWT({ sub: userId }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(Math.floor(expiresAt.getTime() / 1000)).sign(secret()); }
export async function verifySession(token: string) { try { const result = await jwtVerify(token, secret()); return result.payload.sub || null; } catch { return null; } }
