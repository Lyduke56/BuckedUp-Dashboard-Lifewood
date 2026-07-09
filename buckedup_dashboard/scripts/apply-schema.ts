/**
 * Applies supabase/schema.sql directly to the project via Postgres.
 * DDL (CREATE TABLE, RLS policies, triggers) isn't exposed through
 * PostgREST, so this needs a real Postgres connection — SUPABASE_DB_URL,
 * not the API URL/keys the app itself uses.
 *
 * Run:
 *   npm run db:apply-schema
 *
 * Safe to re-run against a fresh project; NOT idempotent against one that
 * already has these tables (CREATE TABLE will fail if they exist).
 */

import { readFileSync } from "fs";
import path from "path";
import { Client } from "pg";

async function main() {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    throw new Error("SUPABASE_DB_URL is not set in .env.local");
  }

  const schemaPath = path.join(process.cwd(), "supabase", "schema.sql");
  const sql = readFileSync(schemaPath, "utf-8");

  const client = new Client({ connectionString });
  await client.connect();
  console.log("Connected. Applying supabase/schema.sql...");

  try {
    await client.query(sql);
    console.log("Schema applied successfully.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
