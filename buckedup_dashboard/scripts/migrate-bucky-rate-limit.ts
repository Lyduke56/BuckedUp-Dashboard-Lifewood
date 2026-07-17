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
CREATE TABLE IF NOT EXISTS bucky_rate_limit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS bucky_rate_limit_log_user_created_idx
  ON bucky_rate_limit_log (user_id, created_at desc);

ALTER TABLE bucky_rate_limit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own select" ON bucky_rate_limit_log;
CREATE POLICY "Own select" ON bucky_rate_limit_log FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Own insert" ON bucky_rate_limit_log;
CREATE POLICY "Own insert" ON bucky_rate_limit_log FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Own delete" ON bucky_rate_limit_log;
CREATE POLICY "Own delete" ON bucky_rate_limit_log FOR DELETE
  USING (user_id = auth.uid());
`;

async function main() {
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

  console.log("Creating bucky_rate_limit_log via Management API...");
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
