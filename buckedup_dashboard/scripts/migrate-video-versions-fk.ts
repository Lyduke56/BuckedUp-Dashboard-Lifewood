/**
 * Fixes video_versions.created_by to ON DELETE SET NULL, matching every
 * other profiles(id) FK in the schema (products.owner_id,
 * notifications.recipient_id, stage_deliverables.submitted_by/reviewed_by).
 * It was the one FK left as NO ACTION, which would block deleting any
 * account that has ever authored a video version. See
 * C:\Users\John Peter\.claude\plans\jaunty-conjuring-cook.md.
 *
 * Requires SUPABASE_ACCESS_TOKEN and NEXT_PUBLIC_SUPABASE_URL in .env.local.
 * Run: npx tsx scripts/migrate-video-versions-fk.ts
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
alter table video_versions
  drop constraint video_versions_created_by_fkey,
  add constraint video_versions_created_by_fkey
    foreign key (created_by) references profiles(id) on delete set null;
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
