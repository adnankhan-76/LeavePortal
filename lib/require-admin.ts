import { cookies } from "next/headers";
import { getAdminById, getUserById } from "@/lib/db";

// Returns true if the session belongs to:
//  - a real row in the `admin` table, OR
//  - a user row whose `role` field has been promoted to 'admin'
export async function isAdminRequest(): Promise<boolean> {
  try {
    const store = await cookies();
    const raw = store.get("sika_session")?.value;
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (parsed.role !== "admin") return false;

    // Check admin table (admin-1, adm-xxxx, etc.)
    const admin = await getAdminById(parsed.id);
    if (admin) return true;

    // Check users table (promoted admin)
    const user = await getUserById(parsed.id);
    return user?.role === "admin";
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

    // Check admin table
    const admin = await getAdminById(parsed.id);
    if (admin) {
      return { id: admin.id, role: "admin", name: admin.name };
    }

    // Check users table
    const user = await getUserById(parsed.id);
    if (user) {
      return { id: user.id, role: user.role === "admin" ? "admin" : "user", name: user.name };
    }

    return null;
  } catch {
    return null;
  }
}
