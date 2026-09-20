import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
const secret = () => process.env.YOUTUBE_OAUTH_STATE_SECRET || "local-development-state-secret";
export function createOAuthState() { const nonce = randomBytes(18).toString("hex"); const signature = createHmac("sha256", secret()).update(nonce).digest("hex"); return `${nonce}.${signature}`; }
export function validateOAuthState(state: string) { const [nonce, signature] = state.split("."); if (!nonce || !signature) return false; const expected = createHmac("sha256", secret()).update(nonce).digest("hex"); return signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected)); }
