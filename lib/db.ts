import { createClient, type InArgs } from "@libsql/client";

// Production (Vercel): set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN.
// Local development: falls back to the local sika.db file (still openable in DB Browser for SQLite).
const url = process.env.TURSO_DATABASE_URL || (process.env.VERCEL ? "" : "file:sika.db");
if (!url) {
  throw new Error("TURSO_DATABASE_URL is not set. Add it (and TURSO_AUTH_TOKEN) in Vercel > Settings > Environment Variables.");
}

const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

let readyPromise: Promise<void> | undefined;
function ready(): Promise<void> {
  if (!readyPromise) {
    readyPromise = init().catch((err) => {
      readyPromise = undefined; // retry on the next request
      throw err;
    });
  }
  return readyPromise;
}

async function init() {
  await db.batch(
    [
      `CREATE TABLE IF NOT EXISTS admin (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL COLLATE NOCASE,
        password TEXT NOT NULL,
        createdAt TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL COLLATE NOCASE,
        password TEXT NOT NULL,
        department TEXT DEFAULT 'General',
        role TEXT NOT NULL DEFAULT 'user',
        sickLeaves INTEGER NOT NULL DEFAULT 7,
        casualLeaves INTEGER NOT NULL DEFAULT 14,
        annualLeaves INTEGER NOT NULL DEFAULT 15,
        createdAt TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS leaves (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        employee TEXT NOT NULL,
        type TEXT NOT NULL,
        startDate TEXT NOT NULL,
        endDate TEXT NOT NULL,
        days INTEGER NOT NULL,
        reason TEXT,
        status TEXT NOT NULL DEFAULT 'Pending',
        createdAt TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipient TEXT NOT NULL,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        leaveId TEXT,
        isRead INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications (recipient, isRead)`,
    ],
    "write"
  );

  // Migration: users created by first-time Google sign-in wait for the admin to fill their details.
  try {
    await db.execute("ALTER TABLE users ADD COLUMN needsDetails INTEGER NOT NULL DEFAULT 0");
  } catch {
    // column already exists
  }

  // Migration: add role column (default 'user')
  try {
    await db.execute("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
  } catch {
    // column already exists
  }

  // Ensure default admin (admin-1) has email admin@sikka.com.pk and password 123456
  try {
    await db.execute({
      sql: "UPDATE admin SET email = ?, password = ? WHERE id = ?",
      args: ["admin@sikka.com.pk", "123456", "admin-1"],
    });
  } catch {
    // ignore
  }

  // Default admin: admin@sikka.com.pk / 123456
  const existing = await db.execute({
    sql: "SELECT id FROM admin WHERE email = ?",
    args: ["admin@sikka.com.pk"],
  });
  if (existing.rows.length === 0) {
    await db.execute({
      sql: "INSERT OR IGNORE INTO admin (id, name, email, password, createdAt) VALUES (?, ?, ?, ?, ?)",
      args: ["admin-1", "System Admin", "admin@sikka.com.pk", "123456", new Date().toISOString()],
    });
  }
}

// ---- small query helpers (rows converted to plain objects) ----
async function all<T>(sql: string, args: InArgs = []): Promise<T[]> {
  await ready();
  const rs = await db.execute({ sql, args });
  return rs.rows.map((row) =>
    Object.fromEntries(rs.columns.map((c, i) => [c, row[i]]))
  ) as T[];
}

async function get<T>(sql: string, args: InArgs = []): Promise<T | undefined> {
  return (await all<T>(sql, args))[0];
}

async function run(sql: string, args: InArgs = []): Promise<number> {
  await ready();
  const rs = await db.execute({ sql, args });
  return rs.rowsAffected;
}

export interface AdminRecord {
  id: string;
  name: string;
  email: string;
  password?: string;
  createdAt: string;
}

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  password?: string;
  department: string;
  role: string;
  sickLeaves: number;
  casualLeaves: number;
  annualLeaves: number;
  needsDetails?: number;
  createdAt: string;
}

export interface LeaveRecord {
  id: string;
  userId: string;
  employee: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: "Pending" | "Approved" | "Rejected";
  createdAt: string;
}

export interface NotificationRecord {
  id: number;
  recipient: string;
  type: string;
  message: string;
  leaveId: string | null;
  isRead: number;
  createdAt: string;
}

// ==================== 1. ADMIN TABLE FUNCTIONS ====================
export async function getAdminByEmail(email: string): Promise<(AdminRecord & { password: string }) | undefined> {
  return get<AdminRecord & { password: string }>("SELECT * FROM admin WHERE email = ?", [email.trim().toLowerCase()]);
}

export async function getAdminById(id: string): Promise<AdminRecord | undefined> {
  return get<AdminRecord>("SELECT id, name, email, createdAt FROM admin WHERE id = ?", [id]);
}

export async function updateAdminPassword(id: string, newPassword: string): Promise<boolean> {
  return (await run("UPDATE admin SET password = ? WHERE id = ?", [newPassword, id])) > 0;
}

export async function ensureDefaultAdmin(): Promise<void> {
  try {
    const existing = await get<AdminRecord & { password: string }>(
      "SELECT * FROM admin WHERE email = ? OR email = ?",
      ["admin@sikka.com.pk", "admin@sikka.com"]
    );
    if (!existing) {
      await run(
        "INSERT INTO admin (id, name, email, password, createdAt) VALUES (?, ?, ?, ?, ?)",
        ["admin-1", "System Admin", "admin@sikka.com.pk", "123456", new Date().toISOString()]
      );
    } else {
      await run("UPDATE admin SET email = ?, password = ? WHERE id = ?", [
        "admin@sikka.com.pk",
        "123456",
        existing.id,
      ]);
    }
  } catch (err) {
    console.error("ensureDefaultAdmin error:", err);
  }
}

// ==================== 2. USERS TABLE FUNCTIONS ====================
export async function getUserByEmail(email: string): Promise<(UserRecord & { password: string }) | undefined> {
  return get<UserRecord & { password: string }>("SELECT * FROM users WHERE email = ?", [email.trim().toLowerCase()]);
}

export async function getUserById(id: string): Promise<UserRecord | undefined> {
  return get<UserRecord>(
    "SELECT id, name, email, department, role, sickLeaves, casualLeaves, annualLeaves, needsDetails, createdAt FROM users WHERE id = ?",
    [id]
  );
}

export async function createUser(data: {
  name: string;
  email: string;
  password: string;
  department?: string;
  sickLeaves?: number;
  casualLeaves?: number;
  annualLeaves?: number;
}): Promise<UserRecord> {
  const id = `usr-${Math.floor(1000 + Math.random() * 9000)}`;
  const record = {
    id,
    name: data.name.trim(),
    email: data.email.trim().toLowerCase(),
    password: data.password,
    department: data.department || "General",
    sickLeaves: Number(data.sickLeaves ?? 7),
    casualLeaves: Number(data.casualLeaves ?? 14),
    annualLeaves: Number(data.annualLeaves ?? 15),
    createdAt: new Date().toISOString(),
  };

  await run(
    `INSERT INTO users (id, name, email, password, department, sickLeaves, casualLeaves, annualLeaves, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.name,
      record.email,
      record.password,
      record.department,
      record.sickLeaves,
      record.casualLeaves,
      record.annualLeaves,
      record.createdAt,
    ]
  );

  return {
    id: record.id,
    name: record.name,
    email: record.email,
    department: record.department,
    role: "user",
    sickLeaves: record.sickLeaves,
    casualLeaves: record.casualLeaves,
    annualLeaves: record.annualLeaves,
    createdAt: record.createdAt,
  };
}

export async function updateUserPassword(id: string, newPassword: string): Promise<boolean> {
  return (await run("UPDATE users SET password = ? WHERE id = ?", [newPassword, id])) > 0;
}

export async function getAllUsers(): Promise<UserRecord[]> {
  return all<UserRecord>(
    "SELECT id, name, email, department, role, sickLeaves, casualLeaves, annualLeaves, needsDetails, createdAt FROM users ORDER BY createdAt DESC"
  );
}

// ==================== 3. LEAVES TABLE FUNCTIONS ====================
export async function getAllLeaves(): Promise<LeaveRecord[]> {
  return all<LeaveRecord>("SELECT * FROM leaves ORDER BY createdAt DESC, id DESC");
}

export async function getLeavesByUserId(userId: string): Promise<LeaveRecord[]> {
  return all<LeaveRecord>("SELECT * FROM leaves WHERE userId = ? ORDER BY createdAt DESC, id DESC", [userId]);
}

export async function getLeaveById(id: string): Promise<LeaveRecord | undefined> {
  return get<LeaveRecord>("SELECT * FROM leaves WHERE id = ?", [id]);
}

export async function createLeave(data: {
  userId: string;
  employee: string;
  type: string;
  startDate: string;
  endDate: string;
  days?: number;
  reason?: string;
}): Promise<LeaveRecord> {
  const id = `LV-${Math.floor(100 + Math.random() * 900)}`;

  let calculatedDays = data.days || 1;
  if (!data.days && data.startDate && data.endDate) {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    calculatedDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);
  }

  const record: LeaveRecord = {
    id,
    userId: data.userId,
    employee: data.employee,
    type: data.type,
    startDate: data.startDate,
    endDate: data.endDate,
    days: calculatedDays,
    reason: data.reason || "General leave request",
    status: "Pending",
    createdAt: new Date().toISOString(),
  };

  await run(
    `INSERT INTO leaves (id, userId, employee, type, startDate, endDate, days, reason, status, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.userId,
      record.employee,
      record.type,
      record.startDate,
      record.endDate,
      record.days,
      record.reason,
      record.status,
      record.createdAt,
    ]
  );

  return record;
}

export type DecideResult =
  | { ok: true; leave: LeaveRecord }
  | { ok: false; reason: "not_found" | "already_decided"; leave?: LeaveRecord };

// A leave can be decided only once: the UPDATE only matches rows that are still 'Pending'.
export async function decideLeave(id: string, status: "Approved" | "Rejected"): Promise<DecideResult> {
  const changes = await run("UPDATE leaves SET status = ? WHERE id = ? AND status = 'Pending'", [status, id]);

  const leave = await getLeaveById(id);
  if (!leave) return { ok: false, reason: "not_found" };
  if (changes === 0) return { ok: false, reason: "already_decided", leave };
  return { ok: true, leave };
}

export async function deleteLeave(id: string): Promise<boolean> {
  return (await run("DELETE FROM leaves WHERE id = ?", [id])) > 0;
}

export async function getLeaveStats(userId?: string) {
  const row = await get<{ total: number; pending: number; approved: number; rejected: number }>(
    `SELECT
       COUNT(*) AS total,
       COALESCE(SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END), 0) AS pending,
       COALESCE(SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END), 0) AS approved,
       COALESCE(SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END), 0) AS rejected
     FROM leaves ${userId ? "WHERE userId = ?" : ""}`,
    userId ? [userId] : []
  );
  return {
    total: Number(row?.total ?? 0),
    pending: Number(row?.pending ?? 0),
    approved: Number(row?.approved ?? 0),
    rejected: Number(row?.rejected ?? 0),
  };
}

function computeBalances(user: UserRecord, usedRows: { type: string; totalDays: number }[]) {
  let sickUsed = 0;
  let casualUsed = 0;
  let annualUsed = 0;
  let wfhUsed = 0;

  for (const row of usedRows) {
    const t = row.type.toLowerCase();
    const days = Number(row.totalDays);
    if (t.includes("sick")) {
      sickUsed += days;
    } else if (t.includes("casual")) {
      casualUsed += days;
    } else if (t.includes("annual")) {
      annualUsed += days;
    } else if (t.includes("work from home") || t.includes("wfh")) {
      wfhUsed += days;
    }
  }

  return {
    sick: { allowed: user.sickLeaves, used: sickUsed, remaining: Math.max(0, user.sickLeaves - sickUsed) },
    casual: { allowed: user.casualLeaves, used: casualUsed, remaining: Math.max(0, user.casualLeaves - casualUsed) },
    annual: { allowed: user.annualLeaves, used: annualUsed, remaining: Math.max(0, user.annualLeaves - annualUsed) },
    wfh: { used: wfhUsed },
  };
}

export async function getUserLeaveBalances(userId: string) {
  let [user, usedRows] = await Promise.all([
    getUserById(userId),
    all<{ type: string; totalDays: number }>(
      `SELECT type, SUM(days) as totalDays FROM leaves WHERE userId = ? AND status = 'Approved' GROUP BY type`,
      [userId]
    ),
  ]);

  if (!user) {
    const admin = await getAdminById(userId);
    if (admin) {
      user = {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        department: "Management",
        role: "admin",
        sickLeaves: 7,
        casualLeaves: 14,
        annualLeaves: 15,
        needsDetails: 0,
        createdAt: admin.createdAt,
      };
    }
  }

  if (!user) return null;
  return computeBalances(user, usedRows);
}

export async function getAllUsersWithBalances() {
  // Two queries total (instead of one per user).
  const [users, usedRows] = await Promise.all([
    getAllUsers(),
    all<{ userId: string; type: string; totalDays: number }>(
      "SELECT userId, type, SUM(days) AS totalDays FROM leaves WHERE status = 'Approved' GROUP BY userId, type"
    ),
  ]);

  const usedByUser = new Map<string, { type: string; totalDays: number }[]>();
  for (const row of usedRows) {
    const list = usedByUser.get(row.userId) ?? [];
    list.push({ type: row.type, totalDays: row.totalDays });
    usedByUser.set(row.userId, list);
  }

  return users.map((u) => ({
    ...u,
    balances: computeBalances(u, usedByUser.get(u.id) ?? []),
  }));
}

// ==================== NOTIFICATIONS ====================
export interface NotificationRecord {
  id: number;
  recipient: string;
  type: string;
  message: string;
  leaveId: string | null;
  isRead: number;
  createdAt: string;
}

// recipient is a user id, or the literal 'admin' (shown to every admin).
export async function createNotification(data: {
  recipient: string;
  type: string;
  message: string;
  leaveId?: string;
}): Promise<void> {
  await run(
    "INSERT INTO notifications (recipient, type, message, leaveId, isRead, createdAt) VALUES (?, ?, ?, ?, 0, ?)",
    [data.recipient, data.type, data.message, data.leaveId ?? null, new Date().toISOString()]
  );
}

export async function getNotifications(recipient: string, limit = 20): Promise<NotificationRecord[]> {
  return all<NotificationRecord>("SELECT * FROM notifications WHERE recipient = ? ORDER BY id DESC LIMIT ?", [
    recipient,
    limit,
  ]);
}

export async function markNotificationsRead(recipient: string, id?: number): Promise<void> {
  if (id) {
    await run("UPDATE notifications SET isRead = 1 WHERE recipient = ? AND id = ?", [recipient, id]);
  } else {
    await run("UPDATE notifications SET isRead = 1 WHERE recipient = ?", [recipient]);
  }
}

// First-time Google sign-in: store the @sikka.com.pk email, admin fills the rest later.
export async function createGoogleUser(data: { name: string; email: string }): Promise<UserRecord> {
  const id = `usr-${Math.floor(10000 + Math.random() * 90000)}`;
  const email = data.email.trim().toLowerCase();
  const name = data.name.trim() || email.split("@")[0];
  const randomPassword = `g-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const createdAt = new Date().toISOString();

  await run(
    `INSERT INTO users (id, name, email, password, department, sickLeaves, casualLeaves, annualLeaves, needsDetails, createdAt)
     VALUES (?, ?, ?, ?, 'Not assigned', 0, 0, 0, 1, ?)`,
    [id, name, email, randomPassword, createdAt]
  );

  return (await getUserById(id))!;
}

// ==================== ADMIN / USER MANAGEMENT ====================
export async function getAllAdmins(): Promise<AdminRecord[]> {
  return all<AdminRecord>("SELECT id, name, email, createdAt FROM admin ORDER BY createdAt ASC");
}

export async function createAdmin(data: { name: string; email: string; password: string }): Promise<AdminRecord> {
  const id = `adm-${Math.floor(1000 + Math.random() * 9000)}`;
  const record = {
    id,
    name: data.name.trim(),
    email: data.email.trim().toLowerCase(),
    password: data.password,
    createdAt: new Date().toISOString(),
  };
  await run("INSERT INTO admin (id, name, email, password, createdAt) VALUES (?, ?, ?, ?, ?)", [
    record.id,
    record.name,
    record.email,
    record.password,
    record.createdAt,
  ]);
  return { id: record.id, name: record.name, email: record.email, createdAt: record.createdAt };
}

export async function updateAdmin(
  id: string,
  data: { name?: string; email?: string; password?: string }
): Promise<AdminRecord | null> {
  const current = await get<AdminRecord & { password: string }>("SELECT * FROM admin WHERE id = ?", [id]);
  if (!current) return null;
  await run("UPDATE admin SET name = ?, email = ?, password = ? WHERE id = ?", [
    data.name?.trim() || current.name,
    data.email?.trim().toLowerCase() || current.email,
    data.password || current.password,
    id,
  ]);
  return (await getAdminById(id)) || null;
}

export async function updateUser(
  id: string,
  data: {
    name?: string;
    email?: string;
    password?: string;
    department?: string;
    role?: string;
    sickLeaves?: number;
    casualLeaves?: number;
    annualLeaves?: number;
  }
): Promise<UserRecord | null> {
  const current = await get<UserRecord & { password: string }>("SELECT * FROM users WHERE id = ?", [id]);
  if (!current) return null;
  await run(
    `UPDATE users SET name = ?, email = ?, password = ?, department = ?, role = ?,
     sickLeaves = ?, casualLeaves = ?, annualLeaves = ?, needsDetails = 0 WHERE id = ?`,
    [
      data.name?.trim() || current.name,
      data.email?.trim().toLowerCase() || current.email,
      data.password || current.password,
      data.department || current.department,
      data.role ?? current.role ?? 'user',
      data.sickLeaves ?? current.sickLeaves,
      data.casualLeaves ?? current.casualLeaves,
      data.annualLeaves ?? current.annualLeaves,
      id,
    ]
  );
  return (await getUserById(id)) || null;
}

export async function emailTakenByOther(email: string, ownId: string): Promise<boolean> {
  const e = email.trim().toLowerCase();
  const a = await get("SELECT id FROM admin WHERE email = ? AND id != ?", [e, ownId]);
  const u = await get("SELECT id FROM users WHERE email = ? AND id != ?", [e, ownId]);
  return !!(a || u);
}

export default db;
