import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/require-admin";
import { createUser, getAllUsersWithBalances, getUserByEmail, getAdminByEmail } from "@/lib/db";

// GET /api/users - List all users from 'users' table with live balances
export async function GET() {
  try {
    const users = getAllUsersWithBalances();
    return NextResponse.json({ success: true, users });
  } catch (error) {
    console.error("Failed to fetch users from SQLite:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

// POST /api/users - Admin adds new user into 'users' table
export async function POST(request: Request) {
  try {
    if (!(await isAdminRequest())) {
      return NextResponse.json({ success: false, error: "Admins only" }, { status: 403 });
    }
    const body = await request.json();
    const {
      name,
      email,
      password,
      department = "Engineering",
      sickLeaves = 7,
      casualLeaves = 14,
      annualLeaves = 15,
    } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { success: false, error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    // Check if email already used in 'admin' or 'users'
    if (getAdminByEmail(email) || getUserByEmail(email)) {
      return NextResponse.json(
        { success: false, error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const newUser = createUser({
      name,
      email,
      password,
      department,
      sickLeaves: Number(sickLeaves),
      casualLeaves: Number(casualLeaves),
      annualLeaves: Number(annualLeaves),
    });

    return NextResponse.json(
      { success: true, user: newUser, message: "User created in 'users' table!" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating user in SQLite:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create user in SQLite" },
      { status: 500 }
    );
  }
}
