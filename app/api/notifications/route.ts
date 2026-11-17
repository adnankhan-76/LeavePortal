import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/require-admin";
import { getNotifications, markNotificationsRead } from "@/lib/db";

// Admins read the shared 'admin' inbox; users read their own.
function recipientFor(session: { id: string; role: "admin" | "user" }) {
  return session.role === "admin" ? "admin" : session.id;
}

// GET /api/notifications - latest notifications for the logged-in person
export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ success: false, notifications: [] }, { status: 401 });

  const notifications = await getNotifications(recipientFor(session));
  const unread = notifications.filter((n) => !n.isRead).length;
  return NextResponse.json({ success: true, notifications, unread });
}

// PATCH /api/notifications - mark one ({ id }) or all as read
export async function PATCH(request: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ success: false }, { status: 401 });

  let id: number | undefined;
  try {
    const body = await request.json();
    if (body?.id) id = Number(body.id);
  } catch {
    // no body = mark all
  }
  await markNotificationsRead(recipientFor(session), id);
  return NextResponse.json({ success: true });
}
