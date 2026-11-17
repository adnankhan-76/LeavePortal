import { NextResponse } from "next/server";
import { createAdmin, getAllAdmins, getAdminByEmail, getUserByEmail } from "@/lib/db";
import { isAdminRequest } from "@/lib/require-admin";

export async function GET() {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ success: false, error: "Admins only" }, { status: 403 });
  }
  return NextResponse.json({ success: true, admins: (await getAllAdmins()) });
}

export async function POST(request: Request) {
  try {
    if (!(await isAdminRequest())) {
      return NextResponse.json({ success: false, error: "Admins only" }, { status: 403 });
    }
    const { name, email, password } = await request.json();
    if (!name || !email || !password) {
      return NextResponse.json(
        { success: false, error: "Name, email, and password are required" },
        { status: 400 }
      );
    }
    if ((await getAdminByEmail(email)) || (await getUserByEmail(email))) {
      return NextResponse.json(
        { success: false, error: "An account with this email already exists" },
        { status: 409 }
      );
    }
    const admin = await createAdmin({ name, email, password });
    return NextResponse.json({ success: true, admin }, { status: 201 });
  } catch (error) {
    console.error("Create admin error:", error);
    return NextResponse.json({ success: false, error: "Failed to create admin" }, { status: 500 });
  }
}
