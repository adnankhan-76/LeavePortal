import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "sika.db");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");



// Initialize EXACTLY 3 tables: admin, users, and leaves
db.exec(`
  CREATE TABLE IF NOT EXISTS admin (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password TEXT NOT NULL,
    department TEXT DEFAULT 'General',
    sickLeaves INTEGER NOT NULL DEFAULT 7,
    casualLeaves INTEGER NOT NULL DEFAULT 14,
    annualLeaves INTEGER NOT NULL DEFAULT 15,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS leaves (
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
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipient TEXT NOT NULL,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    leaveId TEXT,
    isRead INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications (recipient, isRead);
`);

// Migration: users created by first-time Google sign-in wait for the admin to fill their details.
try {
  db.exec("ALTER TABLE users ADD COLUMN needsDetails INTEGER NOT NULL DEFAULT 0");
} catch {
  // column already exists
}

// Default admin: admin@sikka.com.pk / 123456
// Migrate the old default admin (admin@sikka.com) to the .pk email if it exists.
try {
  db.prepare("UPDATE admin SET email = ? WHERE id = ? AND email = ?").run(
    "admin@sikka.com.pk",
    "admin-1",
    "admin@sikka.com"
  );
} catch {
  // ignore (e.g. database busy or .pk email already present)
}

const existingAdmin = db
  .prepare("SELECT id FROM admin WHERE email = ?")
  .get("admin@sikka.com.pk");

if (!existingAdmin) {
  db.prepare(`
    INSERT OR IGNORE INTO admin
    (id, name, email, password, createdAt)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    "admin-1",
    "System Admin",
    "admin@sikka.com.pk",
    "123456",
    new Date().toISOString()
  );
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

// ==================== 1. ADMIN TABLE FUNCTIONS ====================
export function getAdminByEmail(email: string): (AdminRecord & { password: string }) | undefined {
  return db.prepare("SELECT * FROM admin WHERE email = ?").get(email.trim().toLowerCase()) as (AdminRecord & { password: string }) | undefined;
}

export function getAdminById(id: string): AdminRecord | undefined {
  return db.prepare("SELECT id, name, email, createdAt FROM admin WHERE id = ?").get(id) as AdminRecord | undefined;
}

export function updateAdminPassword(id: string, newPassword: string): boolean {
  const result = db.prepare("UPDATE admin SET password = ? WHERE id = ?").run(newPassword, id);
  return result.changes > 0;
}

// ==================== 2. USERS TABLE FUNCTIONS ====================
export function getUserByEmail(email: string): (UserRecord & { password: string }) | undefined {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email.trim().toLowerCase()) as (UserRecord & { password: string }) | undefined;
}

export function getUserById(id: string): UserRecord | undefined {
  return db.prepare("SELECT id, name, email, department, sickLeaves, casualLeaves, annualLeaves, needsDetails, createdAt FROM users WHERE id = ?").get(id) as UserRecord | undefined;
}

export function createUser(data: {
  name: string;
  email: string;
  password: string;
  department?: string;
  sickLeaves?: number;
  casualLeaves?: number;
  annualLeaves?: number;
}): UserRecord {
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

  db.prepare(`
    INSERT INTO users (id, name, email, password, department, sickLeaves, casualLeaves, annualLeaves, createdAt)
    VALUES (@id, @name, @email, @password, @department, @sickLeaves, @casualLeaves, @annualLeaves, @createdAt)
  `).run(record);

  return {
    id: record.id,
    name: record.name,
    email: record.email,
    department: record.department,
    sickLeaves: record.sickLeaves,
    casualLeaves: record.casualLeaves,
    annualLeaves: record.annualLeaves,
    createdAt: record.createdAt,
  };
}

export function updateUserPassword(id: string, newPassword: string): boolean {
  const result = db.prepare("UPDATE users SET password = ? WHERE id = ?").run(newPassword, id);
  return result.changes > 0;
}

export function getAllUsers(): UserRecord[] {
  return db.prepare("SELECT id, name, email, department, sickLeaves, casualLeaves, annualLeaves, needsDetails, createdAt FROM users ORDER BY createdAt DESC").all() as UserRecord[];
}

// ==================== 3. LEAVES TABLE FUNCTIONS ====================
export function getAllLeaves(): LeaveRecord[] {
  return db.prepare("SELECT * FROM leaves ORDER BY createdAt DESC, id DESC").all() as LeaveRecord[];
}

export function getLeavesByUserId(userId: string): LeaveRecord[] {
  return db.prepare("SELECT * FROM leaves WHERE userId = ? ORDER BY createdAt DESC, id DESC").all(userId) as LeaveRecord[];
}

export function getLeaveById(id: string): LeaveRecord | undefined {
  return db.prepare("SELECT * FROM leaves WHERE id = ?").get(id) as LeaveRecord | undefined;
}

export function createLeave(data: {
  userId: string;
  employee: string;
  type: string;
  startDate: string;
  endDate: string;
  days?: number;
  reason?: string;
}): LeaveRecord {
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

  db.prepare(`
    INSERT INTO leaves (id, userId, employee, type, startDate, endDate, days, reason, status, createdAt)
    VALUES (@id, @userId, @employee, @type, @startDate, @endDate, @days, @reason, @status, @createdAt)
  `).run(record);

  return record;
}

export type DecideResult =
  | { ok: true; leave: LeaveRecord }
  | { ok: false; reason: "not_found" | "already_decided"; leave?: LeaveRecord };

// A leave can be decided only once: the UPDATE only matches rows that are still 'Pending'.
export function decideLeave(id: string, status: "Approved" | "Rejected"): DecideResult {
  const result = db
    .prepare("UPDATE leaves SET status = ? WHERE id = ? AND status = 'Pending'")
    .run(status, id);

  const leave = getLeaveById(id);
  if (!leave) return { ok: false, reason: "not_found" };
  if (result.changes === 0) return { ok: false, reason: "already_decided", leave };
  return { ok: true, leave };
}

export function deleteLeave(id: string): boolean {
  const result = db.prepare("DELETE FROM leaves WHERE id = ?").run(id);
  return result.changes > 0;
}

export function getLeaveStats(userId?: string) {
  if (userId) {
    const total = db.prepare("SELECT COUNT(*) as count FROM leaves WHERE userId = ?").get(userId) as { count: number };
    const pending = db.prepare("SELECT COUNT(*) as count FROM leaves WHERE userId = ? AND status = 'Pending'").get(userId) as { count: number };
    const approved = db.prepare("SELECT COUNT(*) as count FROM leaves WHERE userId = ? AND status = 'Approved'").get(userId) as { count: number };
    const rejected = db.prepare("SELECT COUNT(*) as count FROM leaves WHERE userId = ? AND status = 'Rejected'").get(userId) as { count: number };

    return {
      total: total.count,
      pending: pending.count,
      approved: approved.count,
      rejected: rejected.count,
    };
  }

  const total = db.prepare("SELECT COUNT(*) as count FROM leaves").get() as { count: number };
  const pending = db.prepare("SELECT COUNT(*) as count FROM leaves WHERE status = 'Pending'").get() as { count: number };
  const approved = db.prepare("SELECT COUNT(*) as count FROM leaves WHERE status = 'Approved'").get() as { count: number };
  const rejected = db.prepare("SELECT COUNT(*) as count FROM leaves WHERE status = 'Rejected'").get() as { count: number };

  return {
    total: total.count,
    pending: pending.count,
    approved: approved.count,
    rejected: rejected.count,
  };
}

export function getUserLeaveBalances(userId: string) {
  const user = getUserById(userId);
  if (!user) return null;

  const usedRows = db.prepare(`
    SELECT type, SUM(days) as totalDays 
    FROM leaves 
    WHERE userId = ? AND status = 'Approved'
    GROUP BY type
  `).all(userId) as { type: string; totalDays: number }[];

  let sickUsed = 0;
  let casualUsed = 0;
  let annualUsed = 0;
  let wfhUsed = 0;

  for (const row of usedRows) {
    const t = row.type.toLowerCase();
    if (t.includes("sick")) {
      sickUsed += row.totalDays;
    } else if (t.includes("casual")) {
      casualUsed += row.totalDays;
    } else if (t.includes("annual")) {
      annualUsed += row.totalDays;
    } else if (t.includes("work from home") || t.includes("wfh")) {
      wfhUsed += row.totalDays;
    }
  }

  return {
    sick: {
      allowed: user.sickLeaves,
      used: sickUsed,
      remaining: Math.max(0, user.sickLeaves - sickUsed),
    },
    casual: {
      allowed: user.casualLeaves,
      used: casualUsed,
      remaining: Math.max(0, user.casualLeaves - casualUsed),
    },
    annual: {
      allowed: user.annualLeaves,
      used: annualUsed,
      remaining: Math.max(0, user.annualLeaves - annualUsed),
    },
    wfh: {
      used: wfhUsed,
    },
  };
}

export function getAllUsersWithBalances() {
  const users = getAllUsers();
  return users.map((u) => ({
    ...u,
    balances: getUserLeaveBalances(u.id),
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
export function createNotification(data: {
  recipient: string;
  type: string;
  message: string;
  leaveId?: string;
}) {
  db.prepare(
    "INSERT INTO notifications (recipient, type, message, leaveId, isRead, createdAt) VALUES (?, ?, ?, ?, 0, ?)"
  ).run(data.recipient, data.type, data.message, data.leaveId ?? null, new Date().toISOString());
}

export function getNotifications(recipient: string, limit = 20): NotificationRecord[] {
  return db
    .prepare("SELECT * FROM notifications WHERE recipient = ? ORDER BY id DESC LIMIT ?")
    .all(recipient, limit) as NotificationRecord[];
}

export function markNotificationsRead(recipient: string, id?: number) {
  if (id) {
    db.prepare("UPDATE notifications SET isRead = 1 WHERE recipient = ? AND id = ?").run(recipient, id);
  } else {
    db.prepare("UPDATE notifications SET isRead = 1 WHERE recipient = ?").run(recipient);
  }
}

// First-time Google sign-in: store the @sikka.com.pk email, admin fills the rest later.
export function createGoogleUser(data: { name: string; email: string }): UserRecord {
  const id = `usr-${Math.floor(10000 + Math.random() * 90000)}`;
  const email = data.email.trim().toLowerCase();
  const name = data.name.trim() || email.split("@")[0];
  const randomPassword = `g-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const createdAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO users (id, name, email, password, department, sickLeaves, casualLeaves, annualLeaves, needsDetails, createdAt)
    VALUES (?, ?, ?, ?, 'Not assigned', 0, 0, 0, 1, ?)
  `).run(id, name, email, randomPassword, createdAt);

  return getUserById(id)!;
}

// ==================== ADMIN / USER MANAGEMENT ====================
export function getAllAdmins(): AdminRecord[] {
  return db.prepare("SELECT id, name, email, createdAt FROM admin ORDER BY createdAt ASC").all() as AdminRecord[];
}

export function createAdmin(data: { name: string; email: string; password: string }): AdminRecord {
  const id = `adm-${Math.floor(1000 + Math.random() * 9000)}`;
  const record = {
    id,
    name: data.name.trim(),
    email: data.email.trim().toLowerCase(),
    password: data.password,
    createdAt: new Date().toISOString(),
  };
  db.prepare(
    "INSERT INTO admin (id, name, email, password, createdAt) VALUES (@id, @name, @email, @password, @createdAt)"
  ).run(record);
  return { id: record.id, name: record.name, email: record.email, createdAt: record.createdAt };
}

export function updateAdmin(
  id: string,
  data: { name?: string; email?: string; password?: string }
): AdminRecord | null {
  const current = db.prepare("SELECT * FROM admin WHERE id = ?").get(id) as (AdminRecord & { password: string }) | undefined;
  if (!current) return null;
  db.prepare("UPDATE admin SET name = ?, email = ?, password = ? WHERE id = ?").run(
    data.name?.trim() || current.name,
    data.email?.trim().toLowerCase() || current.email,
    data.password || current.password,
    id
  );
  return getAdminById(id) || null;
}

export function updateUser(
  id: string,
  data: {
    name?: string;
    email?: string;
    password?: string;
    department?: string;
    sickLeaves?: number;
    casualLeaves?: number;
    annualLeaves?: number;
  }
): UserRecord | null {
  const current = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as (UserRecord & { password: string }) | undefined;
  if (!current) return null;
  db.prepare(
    `UPDATE users SET name = ?, email = ?, password = ?, department = ?,
     sickLeaves = ?, casualLeaves = ?, annualLeaves = ?, needsDetails = 0 WHERE id = ?`
  ).run(
    data.name?.trim() || current.name,
    data.email?.trim().toLowerCase() || current.email,
    data.password || current.password,
    data.department || current.department,
    data.sickLeaves ?? current.sickLeaves,
    data.casualLeaves ?? current.casualLeaves,
    data.annualLeaves ?? current.annualLeaves,
    id
  );
  return getUserById(id) || null;
}

export function emailTakenByOther(email: string, ownId: string): boolean {
  const e = email.trim().toLowerCase();
  const a = db.prepare("SELECT id FROM admin WHERE email = ? AND id != ?").get(e, ownId);
  const u = db.prepare("SELECT id FROM users WHERE email = ? AND id != ?").get(e, ownId);
  return !!(a || u);
}

export default db;
