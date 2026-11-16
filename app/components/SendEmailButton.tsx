// Asks the server to email the admin about a leave request.
// Only the leave id is sent: the server builds the email (details + link) from the database.
export async function sendLeaveEmail(leaveId: string) {
  try {
    const res = await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leaveId }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.success) {
      console.error("Email failed:", data.error);
      return false;
    }

    console.log("Leave notification email sent!");
    return true;
  } catch (error) {
    console.error("Email sending error:", error);
    return false;
  }
}
