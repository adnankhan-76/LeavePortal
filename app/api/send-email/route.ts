import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { getSessionUser } from "@/lib/require-admin";
import { getLeaveById, getUserById, getAdminById } from "@/lib/db";
import { isValidLeaveId } from "@/lib/link-safety";
import { buildLeaveLink, escapeHtml, oneLine } from "@/lib/leave-link";

// Leaves we already emailed about (stops the endpoint being used to spam the admin).
const alreadyEmailed = new Set<string>();
const MAX_AGE_MS = 15 * 60 * 1000; // only fresh requests can trigger an email

// POST /api/send-email   body: { leaveId: "LV-123" }
// The client sends ONLY the leave id. Everything in the email (details + link) is
// built here on the server from the database, so it cannot be tampered with.
export async function POST(req: Request) {
  try {
    // 1. Authentication: must be logged in
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    // 2. Input validation
    const body = await req.json().catch(() => null);
    const leaveId = body?.leaveId;
    if (!isValidLeaveId(leaveId)) {
      return NextResponse.json({ success: false, error: "Invalid leave id" }, { status: 400 });
    }

    // 3. Authorization: only the owner of the leave (or an admin) may trigger the email.
    //    Same "not found" answer either way so ids cannot be enumerated.
    const leave = await getLeaveById(leaveId);
    if (!leave || (session.role !== "admin" && leave.userId !== session.id)) {
      return NextResponse.json({ success: false, error: "Leave not found" }, { status: 404 });
    }

    // 4. Abuse limits
    const age = Date.now() - new Date(leave.createdAt).getTime();
    if (leave.status !== "Pending" || age > MAX_AGE_MS || alreadyEmailed.has(leave.id)) {
      return NextResponse.json(
        { success: false, error: "Email not allowed for this leave" },
        { status: 409 }
      );
    }

    const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, MAIL_TO } = process.env;
    const missing = Object.entries({ SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_TO })
      .filter(([, value]) => !value)
      .map(([key]) => key);
    if (missing.length) {
      console.error("Missing env vars:", missing.join(", ")); // details stay in the server log
      return NextResponse.json({ success: false, error: "Email is not configured" }, { status: 500 });
    }

    // 5. Build the email on the server
    const link = buildLeaveLink(leave.id);
    const userRecord = (await getUserById(leave.userId)) || (await getAdminById(leave.userId));
    const employeeEmail = userRecord?.email ?? "";

    const text = [
      "New Leave Request",
      "",
      `Employee: ${leave.employee}`,
      employeeEmail ? `Employee Email: ${employeeEmail}` : "",
      `Leave Type: ${leave.type}`,
      `Start Date: ${leave.startDate}`,
      `End Date: ${leave.endDate}`,
      `Reason: ${leave.reason}`,
      "",
      "Open this leave request:",
      link,
    ]
      .filter((line, i, arr) => line !== "" || arr[i - 1] !== "")
      .join("\n");

    const row = (label: string, value: string) =>
      `<tr><td style="padding:6px 12px 6px 0;color:#666;white-space:nowrap">${label}</td>` +
      `<td style="padding:6px 0;color:#111"><strong>${escapeHtml(value)}</strong></td></tr>`;

    const safeLink = escapeHtml(link);
    const html = `
<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;max-width:560px">
  <h2 style="margin:0 0 12px">New Leave Request</h2>
  <table style="border-collapse:collapse">
    ${row("Employee", leave.employee)}
    ${employeeEmail ? row("Employee Email", employeeEmail) : ""}
    ${row("Leave Type", leave.type)}
    ${row("Start Date", leave.startDate)}
    ${row("End Date", leave.endDate)}
    ${row("Reason", leave.reason)}
  </table>
  <p style="margin:20px 0 8px">
    <a href="${safeLink}" style="background:#DB9617;color:#0D0D0D;text-decoration:none;font-weight:bold;padding:10px 18px;border-radius:8px;display:inline-block">Open leave request</a>
  </p>
  <p style="color:#666;font-size:12px;margin:0">
    Or copy this link: <a href="${safeLink}">${safeLink}</a><br>
    You will be asked to sign in if you are not already.
  </p>
</div>`;

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: SMTP_SECURE === "true",
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    alreadyEmailed.add(leave.id);
    try {
      await transporter.sendMail({
        from: `"Sikka Notifications" <${SMTP_USER}>`,
        to: MAIL_TO,
        subject: oneLine(`New Leave Request - ${leave.employee}`),
        text,
        html,
      });
    } catch (err) {
      alreadyEmailed.delete(leave.id); // allow a retry if sending itself failed
      throw err;
    }

    return NextResponse.json({ success: true, message: "Email sent successfully!" });
  } catch (error) {
    console.error("Send email error:", error);
    // Generic message to the client: never leak SMTP/internal error text.
    return NextResponse.json({ success: false, error: "Could not send email" }, { status: 500 });
  }
}
