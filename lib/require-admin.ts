import { cookies } from "next/headers";
import { getAdminById, getUserById } from "@/lib/db";

// Returns true only if the session cookie belongs to a real admin row.
export async function isAdminRequest(): Promise<boolean> {
  try {
    const store = await cookies();
    const raw = store.get("sika_session")?.value;
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return parsed.role === "admin" && !!getAdminById(parsed.id);
  } catch {
    return false;
  }
}

// Returns the logged-in person from the session cookie (verified against the database).
export async function getSessionUser(): Promise<{ id: string; role: "admin" | "user"; name: string } | null> {
  try {
    const store = await cookies();
    const raw = store.get("sika_session")?.value;
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.role === "admin") {
      const admin = getAdminById(parsed.id);
      return admin ? { id: admin.id, role: "admin", name: admin.name } : null;
    }
    const user = getUserById(parsed.id);
    return user ? { id: user.id, role: "user", name: user.name } : null;
  } catch {
    return null;
  }
}
