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
-- Fix "Operator submit own current stage" RLS policy to allow Storyboarding & Scripting deliverable submissions while product is in 'Design' stage
drop policy if exists "Operator submit own current stage" on stage_deliverables;
create policy "Operator submit own current stage" on stage_deliverables for insert
  with check (
    get_my_role() = 'operator'
    and submitted_by = auth.uid()
    and exists (
      select 1 from products p
      where p.id = product_id
        and p.owner_id = auth.uid()
        and (
          p.status = stage
          or (p.status = 'Design' and stage in ('Storyboarding', 'Scripting'))
        )
    )
  );
`;

async function main() {
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;
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
  console.log("✓ Operator deliverable stage RLS fixed:", body);
}

main();
