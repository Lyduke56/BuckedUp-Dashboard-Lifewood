import { readFileSync } from "fs";
import { join } from "path";

// Manually load .env.local
try {
  const envPath = join(process.cwd(), ".env.local");
  const raw = readFileSync(envPath, "utf-8");
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match) process.env[match[1]] = match[2].trim();
  }
} catch {
  // Ignore
}

const PROJECT_REF = "iixxlgfxrctifelpixgz";
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  console.error("SUPABASE_ACCESS_TOKEN is not set in .env.local");
  process.exit(1);
}

const SQL = `
CREATE TABLE IF NOT EXISTS bucky_audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  role user_role not null,
  tool_name text not null,
  status text not null check (status in ('success', 'error', 'denied')),
  input jsonb not null default '{}'::jsonb,
  result_summary jsonb,
  error_message text,
  call_id text,
  approval_id text,
  created_at timestamptz not null default now()
);

-- Plain (non-partial) unique index — see the comment in supabase/schema.sql
-- for why a partial index broke PostgREST's upsert(onConflict) resolution.
CREATE UNIQUE INDEX IF NOT EXISTS bucky_audit_log_approval_id_idx
  ON bucky_audit_log (approval_id);
CREATE INDEX IF NOT EXISTS bucky_audit_log_user_idx ON bucky_audit_log (user_id, created_at desc);
CREATE INDEX IF NOT EXISTS bucky_audit_log_tool_idx ON bucky_audit_log (tool_name, created_at desc);

ALTER TABLE bucky_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own inserts" ON bucky_audit_log;
CREATE POLICY "Own inserts" ON bucky_audit_log FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Super-Admin read" ON bucky_audit_log;
CREATE POLICY "Super-Admin read" ON bucky_audit_log FOR SELECT
  USING (get_my_role() = 'super-admin');
`;

async function main() {
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

  console.log("Creating bucky_audit_log via Management API...");
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

  console.log("✓ Migration successful:", body);
}

main();
