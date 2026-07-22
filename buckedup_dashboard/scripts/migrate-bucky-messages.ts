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
CREATE TABLE IF NOT EXISTS bucky_messages (
  id text not null,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  parts jsonb not null,
  metadata jsonb,
  created_at timestamptz not null default now(),
  primary key (id, user_id)
);

CREATE INDEX IF NOT EXISTS bucky_messages_user_created_idx
  ON bucky_messages (user_id, created_at asc);

ALTER TABLE bucky_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own select" ON bucky_messages;
CREATE POLICY "Own select" ON bucky_messages FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Super-Admin read" ON bucky_messages;
CREATE POLICY "Super-Admin read" ON bucky_messages FOR SELECT
  USING (get_my_role() = 'super-admin');

DROP POLICY IF EXISTS "Own insert" ON bucky_messages;
CREATE POLICY "Own insert" ON bucky_messages FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Own update" ON bucky_messages;
CREATE POLICY "Own update" ON bucky_messages FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Own delete" ON bucky_messages;
CREATE POLICY "Own delete" ON bucky_messages FOR DELETE
  USING (user_id = auth.uid());
`;

async function main() {
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

  console.log("Creating bucky_messages via Management API...");
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
