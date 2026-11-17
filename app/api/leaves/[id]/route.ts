import { NextResponse } from "next/server";
import { decideLeave, deleteLeave, createNotification } from "@/lib/db";
import { isAdminRequest } from "@/lib/require-admin";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status || !["Approved", "Rejected", "Pending"].includes(status)) {
      return NextResponse.json({ success: false, error: "Invalid status" }, { status: 400 });
    }

    if (!(await isAdminRequest())) {
      return NextResponse.json({ success: false, error: "Admins only" }, { status: 403 });
    }
    if (status === "Pending") {
      return NextResponse.json({ success: false, error: "A leave can only be approved or rejected" }, { status: 400 });
    }

    const result = await decideLeave(id, status);
    if (!result.ok) {
      if (result.reason === "not_found") {
        return NextResponse.json({ success: false, error: "Leave not found" }, { status: 404 });
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

    await createNotification({
      recipient: updated.userId,
      type: status === "Approved" ? "leave_approved" : "leave_rejected",
      message: `Your ${updated.type} (${updated.startDate} to ${updated.endDate}) was ${status.toLowerCase()} by admin`,
      leaveId: updated.id,
    });

    return NextResponse.json({ success: true, leave: updated });
  } catch (error) {
    console.error("Error updating leave:", error);
    return NextResponse.json({ success: false, error: "Failed to update leave" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isAdminRequest())) {
      return NextResponse.json({ success: false, error: "Admins only" }, { status: 403 });
    }
    const { id } = await params;
    const deleted = await deleteLeave(id);
    return NextResponse.json({ success: deleted });
  } catch (error) {
    console.error("Error deleting leave:", error);
    return NextResponse.json({ success: false, error: "Failed to delete leave" }, { status: 500 });
  }
}
