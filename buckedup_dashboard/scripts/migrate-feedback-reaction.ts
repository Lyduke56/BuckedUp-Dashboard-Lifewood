import { readFileSync } from "fs";
import { join } from "path";

try {
  const envPath = join(process.cwd(), ".env.local");
  const raw = readFileSync(envPath, "utf-8");
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match) process.env[match[1]] = match[2].trim();
  }
} catch {}

const PROJECT_REF = "iixxlgfxrctifelpixgz";
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  console.error("SUPABASE_ACCESS_TOKEN not set");
  process.exit(1);
}

const SQL = `
-- Add reaction column to feedback table if it doesn't already exist
alter table feedback
  add column if not exists reaction text check (reaction in ('loved', 'good', 'neutral', 'needs_work', 'unsatisfied'));
`;

async function main() {
  console.log("Applying DB migration: add reaction column to feedback table...");
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: SQL }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("❌ Migration failed:", res.status, text);
    process.exit(1);
  }

  console.log("✅ Migration successful: reaction column added to feedback table!");
}

main().catch(console.error);
