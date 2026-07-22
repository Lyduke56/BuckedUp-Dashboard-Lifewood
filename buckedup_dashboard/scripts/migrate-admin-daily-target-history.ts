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
-- 1. Expand daily_target_history RLS to allow both Admin and Super-Admin
drop policy if exists "Admin upsert daily target history" on daily_target_history;
create policy "Admin and super-admin upsert daily target history" on daily_target_history
  for all using (get_my_role() in ('admin', 'super-admin'));

-- 2. Make log_daily_target_history() security definer so the trigger never fails on role permissions
create or replace function log_daily_target_history()
returns trigger as $$
declare
  v_target integer;
  v_today date := current_date;
begin
  if new.is_active then
    v_target := sum_jsonb_values(new.category_targets);
    insert into daily_target_history (date, target)
    values (v_today, v_target)
    on conflict (date) do update
    set target = excluded.target;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;
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
  console.log("✓ daily_target_history permissions fixed:", body);
}

main();
