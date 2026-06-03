/**
 * Run the SEGGUINÉE schema against Supabase PostgreSQL.
 * Usage: node scripts/run-schema.mjs
 */
import { readFileSync } from "fs";
import pg from "pg";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dirname, "../supabase/schema.sql"), "utf8");

// Supabase connection — use the DB password from the user
const PASSWORD = process.env.SUPABASE_DB_PASSWORD || "CkNZn4uWAzwjpKlk";
const PROJECT = "xyahyajwpzjyrcinbqak";

const pool = new pg.Pool({
  host: `db.${PROJECT}.supabase.co`,
  port: 5432,
  user: "postgres",
  password: PASSWORD,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    console.log("Connecting to Supabase...");
    const client = await pool.connect();
    try {
      console.log("Running schema...");
      await client.query(sql);
      console.log("✅ Schema executed successfully — all 8 tables created.");
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
