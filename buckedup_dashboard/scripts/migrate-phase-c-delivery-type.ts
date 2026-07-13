/**
 * Phase C migration: adds products.delivery_type — 'pipeline' (default,
 * goes through all 7 stages) vs 'link' (an external URL counted as
 * Published the moment it's created, bypassing the pipeline). See
 * C:\Users\John Peter\.claude\plans\jaunty-conjuring-cook.md, Phase C.
 *
 * No trigger/RLS change needed: enforce_product_update_permissions()
 * governs UPDATEs, and products insert is already lead-only — the
 * link+Published combination is just values in a normal Lead insert.
 *
 * Requires SUPABASE_ACCESS_TOKEN and NEXT_PUBLIC_SUPABASE_URL in .env.local.
 *
 * Run:
 *   npx tsx scripts/migrate-phase-c-delivery-type.ts
 */

import { readFileSync } from "fs";
import { join } from "path";

try {
  const envPath = join(process.cwd(), ".env.local");
  const raw = readFileSync(envPath, "utf-8");
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match) process.env[match[1]] = match[2].trim();
  }
} catch {
  // Ignore if .env.local doesn't exist
}

const PROJECT_REF = "iixxlgfxrctifelpixgz";
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  console.error("SUPABASE_ACCESS_TOKEN is not set in .env.local");
  process.exit(1);
}

const SQL = `
alter table products
  add column if not exists delivery_type text not null default 'pipeline'
  check (delivery_type in ('pipeline', 'link'));
`;

async function main() {
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;
  console.log("Running Phase C migration via Management API...");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ query: SQL }),
  });
  const body = await res.json();
  if (!res.ok) {
    console.error("Migration failed:", body);
    process.exit(1);
  }
  console.log("Migration successful:", body);
}

main();
