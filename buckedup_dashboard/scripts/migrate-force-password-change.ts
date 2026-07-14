/**
 * Adds profiles.must_change_password + clear_must_change_password() RPC
 * for the new admin-created-account flow (admin sets a temp password,
 * new user is forced to set their own on first login). See
 * C:\Users\John Peter\.claude\plans\jaunty-conjuring-cook.md.
 *
 * Requires SUPABASE_ACCESS_TOKEN and NEXT_PUBLIC_SUPABASE_URL in .env.local.
 * Run: npx tsx scripts/migrate-force-password-change.ts
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
  // ignore
}

const PROJECT_REF = "iixxlgfxrctifelpixgz";
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  console.error("SUPABASE_ACCESS_TOKEN is not set in .env.local");
  process.exit(1);
}

const SQL = `
alter table profiles
  add column if not exists must_change_password boolean not null default false;

-- Deliberately parameterless: only ever touches auth.uid()'s own row, so
-- "can't target another user's flag" is true by construction, not just by
-- an internal check that could regress.
create or replace function clear_must_change_password()
returns void as $$
begin
  update profiles
  set must_change_password = false
  where id = auth.uid();
end;
$$ language plpgsql security definer set search_path = public;
`;

async function main() {
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;
  console.log("Running migration via Management API...");
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
