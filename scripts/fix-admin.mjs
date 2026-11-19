/**
 * Run once to update the default admin email in Turso DB:
 *   node scripts/fix-admin.mjs
 */

import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";

// Load .env.local
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dir, "..", ".env.local");
try {
  const envContent = readFileSync(envPath, "utf-8");
  dotenv.populate(
    process.env,
    Object.fromEntries(
      envContent
        .split("\n")
        .filter((l) => l && !l.startsWith("#") && l.includes("="))
        .map((l) => [l.split("=")[0].trim(), l.split("=").slice(1).join("=").trim()])
    )
  );
} catch {}

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  console.log("🔍 Current admin table:");
  const before = await db.execute("SELECT id, name, email FROM admin");
  console.table(before.rows);

  // Update existing admin-1 to new email
  const updated = await db.execute({
    sql: "UPDATE admin SET email = ?, password = ? WHERE id = ?",
    args: ["admin@sikka.com.pk", "123456", "admin-1"],
  });
  console.log(`✏️  Rows updated: ${updated.rowsAffected}`);

  // Insert if none exists
  if (updated.rowsAffected === 0) {
    await db.execute({
      sql: "INSERT OR IGNORE INTO admin (id, name, email, password, createdAt) VALUES (?, ?, ?, ?, ?)",
      args: ["admin-1", "System Admin", "admin@sikka.com.pk", "123456", new Date().toISOString()],
    });
    console.log("✅ Inserted new admin-1 row");
  }

  console.log("\n✅ Done — admin table now:");
  const after = await db.execute("SELECT id, name, email FROM admin");
  console.table(after.rows);
}

main().catch((e) => {
  console.error("❌ Error:", e.message);
  process.exit(1);
});

