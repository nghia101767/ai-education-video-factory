export function sessionValidationUrl(requestUrl: string, internalOrigin?: string) {
  const url = new URL("/api/auth/session", internalOrigin?.trim() || requestUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Invalid internal application URL");
  return url;
}

export function requestUsesHttps(request: Request) {
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim().toLowerCase();
  if (forwardedProtocol) return forwardedProtocol === "https";
  return new URL(request.url).protocol === "https:";
}

export function safeLoginDestination(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}
