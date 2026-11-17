import { NextResponse } from "next/server";
import { isAdminRequest, getSessionUser } from "@/lib/require-admin";
import {
  getAllLeaves,
  getLeavesByUserId,
  createLeave,
  decideLeave,
  createNotification,
  getLeaveStats,
  getUserLeaveBalances,
  getUserById,
} from "@/lib/db";

// GET /api/leaves - Fetch leaves from SQLite (all for admin, personal for regular users)
export async function GET(request: Request) {
  try {
    // Must be logged in (verified against the database, not just the cookie contents)
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filterUserId = searchParams.get("userId");

    // Regular users can ONLY ever see their own leaves (ignores ?userId=...).
    // Admins may see all, or filter by user.
    const targetUserId = session.role === "user" ? session.id : filterUserId || undefined;

    let leaves;
    let stats;
    let balances = null;

    if (targetUserId) {
      [leaves, stats, balances] = await Promise.all([
        getLeavesByUserId(targetUserId),
        getLeaveStats(targetUserId),
        getUserLeaveBalances(targetUserId),
      ]);
    } else {
      [leaves, stats] = await Promise.all([getAllLeaves(), getLeaveStats()]);
    }

    return NextResponse.json({ success: true, leaves, stats, balances });
  } catch (error) {
    console.error("Failed to fetch leaves from SQLite:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch leaves from SQLite database" },
      { status: 500 }
    );
  }
}

// POST /api/leaves - Apply for a new leave request (by User or Admin)
export async function POST(request: Request) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { type, startDate, endDate, days, reason } = body;

    // Users can only apply for themselves; identity comes from the session, not the request body.
    const userId = session.role === "user" ? session.id : body.userId || session.id;
    const userRecord = await getUserById(userId);
    const employee = userRecord?.name || session.name || "Employee";

    if (!type || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: "Missing required leave fields" },
        { status: 400 }
      );
    }

    const newLeave = await createLeave({
      userId,
      employee,
      type,
      startDate,
      endDate,
      days: days ? Number(days) : undefined,
      reason,
    });

    // Notify admins (top-right bell) that a leave was applied
    await createNotification({
      recipient: "admin",
      type: "leave_applied",
      message: `${employee} applied for ${type} (${startDate} to ${endDate})`,
      leaveId: newLeave.id,
    });

    const [stats, balances] = await Promise.all([
      getLeaveStats(session.role === "user" ? userId : undefined),
      getUserLeaveBalances(userId),
    ]);

    return NextResponse.json(
      { success: true, leave: newLeave, stats, balances },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create leave in SQLite:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create leave in SQLite database" },
      { status: 500 }
    );
  }
}

// PATCH /api/leaves - Admin Accept or Reject a leave in SQLite
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, status } = body;

    if (!id || !status || !["Approved", "Rejected", "Pending"].includes(status)) {
      return NextResponse.json(
        { success: false, error: "Invalid leave ID or status" },
        { status: 400 }
      );
    }

    if (!(await isAdminRequest())) {
      return NextResponse.json({ success: false, error: "Admins only" }, { status: 403 });
    }
    if (status === "Pending") {
      return NextResponse.json(
        { success: false, error: "A leave can only be approved or rejected" },
        { status: 400 }
      );
    }

    const result = await decideLeave(id, status);
    if (!result.ok) {
      if (result.reason === "not_found") {
        return NextResponse.json({ success: false, error: "Leave record not found" }, { status: 404 });
      }
      return NextResponse.json(
        {
          success: false,
          error: `This leave was already ${result.leave?.status.toLowerCase()}. A decision can only be made once.`,
          leave: result.leave,
        },
        { status: 409 }
      );
    }
    const updated = result.leave;

    // Notify the employee (top-right bell)
    await createNotification({
      recipient: updated.userId,
      type: status === "Approved" ? "leave_approved" : "leave_rejected",
      message: `Your ${updated.type} (${updated.startDate} to ${updated.endDate}) was ${status.toLowerCase()} by admin`,
      leaveId: updated.id,
    });

    const stats = await getLeaveStats();
    return NextResponse.json({ success: true, leave: updated, stats });
  } catch (error) {
    console.error("Failed to update leave in SQLite:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update leave in SQLite database" },
      { status: 500 }
    );
  }
}
