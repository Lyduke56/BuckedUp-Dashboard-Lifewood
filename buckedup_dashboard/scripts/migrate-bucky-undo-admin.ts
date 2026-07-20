/**
 * Widens Bucky's delete-undo infrastructure from lead-only to lead + admin,
 * matching the 5-stage pipeline refactor's role expansion (admin gained the
 * same products/catalog delete powers as lead via "Lead and admin delete"
 * RLS, so Bucky's snapshot/restore path has to follow or an admin's
 * delete_product would fail at the snapshot step).
 *
 * Run: npx tsx scripts/migrate-bucky-undo-admin.ts
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
-- 1. Widen bucky_deleted_product_snapshots RLS from lead-only to lead + admin
drop policy if exists "Lead read" on bucky_deleted_product_snapshots;
drop policy if exists "Lead and admin read" on bucky_deleted_product_snapshots;
create policy "Lead and admin read" on bucky_deleted_product_snapshots for select
  using (get_my_role() in ('lead', 'admin'));

drop policy if exists "Lead insert" on bucky_deleted_product_snapshots;
drop policy if exists "Lead and admin insert" on bucky_deleted_product_snapshots;
create policy "Lead and admin insert" on bucky_deleted_product_snapshots for insert
  with check (get_my_role() in ('lead', 'admin') and user_id = auth.uid());

drop policy if exists "Lead delete expired" on bucky_deleted_product_snapshots;
drop policy if exists "Lead and admin delete expired" on bucky_deleted_product_snapshots;
create policy "Lead and admin delete expired" on bucky_deleted_product_snapshots for delete
  using (get_my_role() in ('lead', 'admin') and expires_at < now());

-- 2. Widen restore_deleted_product()'s self-check the same way (security
--    definer bypasses RLS for its own writes, so this check is the real gate)
create or replace function restore_deleted_product(p_snapshot_id uuid)
returns uuid as $$
declare
  v_row bucky_deleted_product_snapshots;
  v_snapshot jsonb;
  v_new_id uuid;
begin
  if get_my_role() not in ('lead', 'admin') then
    raise exception 'Only leads and admins can restore a deleted product';
  end if;

  select * into v_row from bucky_deleted_product_snapshots
    where id = p_snapshot_id and restored_at is null and expires_at > now();
  if v_row.id is null then
    raise exception 'No restorable snapshot found (already restored, or the undo window has expired)';
  end if;

  v_snapshot := v_row.snapshot;

  insert into products
    select * from jsonb_populate_record(null::products, v_snapshot->'product')
    returning id into v_new_id;

  insert into issues
    select * from jsonb_populate_recordset(null::issues, coalesce(v_snapshot->'issues', '[]'::jsonb));
  insert into product_status_history
    select * from jsonb_populate_recordset(null::product_status_history, coalesce(v_snapshot->'product_status_history', '[]'::jsonb));
  insert into video_versions
    select * from jsonb_populate_recordset(null::video_versions, coalesce(v_snapshot->'video_versions', '[]'::jsonb));
  insert into stage_deliverables
    select * from jsonb_populate_recordset(null::stage_deliverables, coalesce(v_snapshot->'stage_deliverables', '[]'::jsonb));

  update bucky_deleted_product_snapshots set restored_at = now() where id = p_snapshot_id;

  return v_new_id;
end;
$$ language plpgsql security definer set search_path = public;
`;

async function main() {
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

  console.log("Widening Bucky undo infrastructure to lead + admin...");
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
