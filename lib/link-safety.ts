// Pure helpers (no server-only code) so they can be used on both server and client.

// Leave ids look like "LV-123". Anything else is rejected before it is used in a URL,
// a database query, or an email.
const LEAVE_ID_RE = /^LV-\d{3,6}$/;

export function isValidLeaveId(value: unknown): value is string {
  return typeof value === "string" && LEAVE_ID_RE.test(value);
}

// Only these in-app pages may be used as a post-login destination (allowlist).
const ALLOWED_NEXT_PATHS = new Set(["/home", "/leaves"]);

/**
 * Validates a "?next=" value before redirecting after login (prevents open redirects).
 * Returns a safe, same-site relative path such as "/leaves?leave=LV-123", or null.
 */
export function safeNextPath(input: string | null | undefined): string | null {
  if (!input || typeof input !== "string" || input.length > 200) return null;

  // Must be a plain relative path: no "//host", no backslashes, no control characters.
  if (!input.startsWith("/") || input.startsWith("//") || /[\\\u0000-\u001f]/.test(input)) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(input, "http://localhost");
  } catch {
    return null;
  }
  if (parsed.origin !== "http://localhost") return null;
  if (!ALLOWED_NEXT_PATHS.has(parsed.pathname)) return null;

  // Rebuild the query ourselves so only known, validated params survive.
  const out = new URL(parsed.pathname, "http://localhost");
  const leave = parsed.searchParams.get("leave");
  if (parsed.pathname === "/leaves" && isValidLeaveId(leave)) {
    out.searchParams.set("leave", leave);
  }
  return out.pathname + out.search;
}
