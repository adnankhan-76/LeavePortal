import { NextResponse } from "next/server";
import { updateAdmin, emailTakenByOther } from "@/lib/db";
import { isAdminRequest } from "@/lib/require-admin";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isAdminRequest())) {
      return NextResponse.json({ success: false, error: "Admins only" }, { status: 403 });
    }
    const { id } = await params;
    const body = await request.json();
    if (body.email && (await emailTakenByOther(body.email, id))) {
      return NextResponse.json(
        { success: false, error: "Another account already uses this email" },
        { status: 409 }
      );
    }
    const admin = await updateAdmin(id, {
      name: body.name,
      email: body.email,
      password: body.password || undefined,
    });
    if (!admin) return NextResponse.json({ success: false, error: "Admin not found" }, { status: 404 });
    return NextResponse.json({ success: true, admin });
  } catch (error) {
    console.error("Update admin error:", error);
    return NextResponse.json({ success: false, error: "Failed to update admin" }, { status: 500 });
  }
}
