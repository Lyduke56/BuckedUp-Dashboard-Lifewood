/**
 * Applies the 'priority' column migration to the products table.
 * 
 * Run:
 *   npx ts-node --compilerOptions '{"module":"commonjs"}' scripts/migrate-video-priority.ts
 */

import * as fs from "fs";
const envStr = fs.readFileSync(".env.local", "utf8");
const dbUrlMatch = envStr.match(/SUPABASE_DB_URL=([^\r\n]+)/);
if (dbUrlMatch) process.env.SUPABASE_DB_URL = dbUrlMatch[1].trim();
import { Client } from "pg";

async function main() {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    throw new Error("SUPABASE_DB_URL is not set in .env.local");
  }

  const client = new Client({ connectionString });
  await client.connect();
  console.log("Connected. Migrating video priority...");

  try {
    // 1. Add the column. We use 'Low' as the default for all existing items.
    const sql = `
      ALTER TABLE products 
      ADD COLUMN IF NOT EXISTS priority text not null default 'Low' 
      check (priority in ('High', 'Medium', 'Low'));
      
      -- Force PostgREST to reload the schema cache so the API recognizes the new column
      NOTIFY pgrst, 'reload schema';
    `;
    await client.query(sql);
    console.log("Migration and schema reload applied successfully.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
