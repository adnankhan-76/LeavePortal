// Server-only helpers for building the link that goes inside the leave email.
import { isValidLeaveId } from "./link-safety";

// The link base comes ONLY from the APP_URL env var. Never build it from request
// headers (Host / X-Forwarded-Host), because those can be spoofed (host-header injection).
function getAppBaseUrl(): URL {
  const raw = process.env.APP_URL;
  if (!raw) throw new Error("APP_URL is not set");

  const url = new URL(raw);
  const isHttps = url.protocol === "https:";
  const isLocalHttp = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);

  // Production links must be https. Plain http is allowed only for local development.
  if (!isHttps && !(isLocalHttp && process.env.NODE_ENV !== "production")) {
    throw new Error("APP_URL must be an https URL (http is allowed only on localhost in development)");
  }
  return url;
}

// Deep link to one leave request. Contains ONLY the leave id: no email address,
// no token, no personal data (URLs end up in logs, browser history and Referer headers).
export function buildLeaveLink(leaveId: string): string {
  if (!isValidLeaveId(leaveId)) throw new Error("Invalid leave id");
  const url = new URL("/leaves", getAppBaseUrl());
  url.searchParams.set("leave", leaveId);
  return url.toString();
}

// Escape user-supplied text before putting it in the HTML part of an email.
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Remove CR/LF so user input can never inject extra email headers (header injection).
export function oneLine(value: unknown, max = 150): string {
  return String(value ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, max);
}
