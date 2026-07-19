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
-- 1. Fix review_stage_deliverable for the 5-stage pipeline (Design -> Production when both Storyboarding & Scripting are accepted)
create or replace function review_stage_deliverable(
  p_deliverable_id uuid,
  p_decision text,
  p_note text
)
returns void as $$
declare
  v_product_id uuid;
  v_stage text;
  v_product_status text;
  v_storyboarding_accepted boolean;
  v_scripting_accepted boolean;
begin
  if p_decision not in ('accepted', 'rejected') then
    raise exception 'decision must be accepted or rejected';
  end if;

  select product_id, stage into v_product_id, v_stage
  from stage_deliverables where id = p_deliverable_id;
  if v_product_id is null then
    raise exception 'deliverable not found';
  end if;

  update stage_deliverables
  set decision = p_decision,
      decision_note = p_note,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_deliverable_id;

  if p_decision = 'accepted' then
    select status into v_product_status from products where id = v_product_id;
    if v_product_status = 'Design' then
      select exists (
        select 1 from stage_deliverables
        where product_id = v_product_id
          and stage = 'Storyboarding'
          and is_current = true
          and decision = 'accepted'
      ) into v_storyboarding_accepted;

      select exists (
        select 1 from stage_deliverables
        where product_id = v_product_id
          and stage = 'Scripting'
          and is_current = true
          and decision = 'accepted'
      ) into v_scripting_accepted;

      if v_storyboarding_accepted and v_scripting_accepted then
        perform set_config('app.allow_stage_advance', 'on', true);
        update products set status = 'Production' where id = v_product_id;
      end if;
    end if;
  end if;
end;
$$ language plpgsql security definer set search_path = public;

-- 2. Expand catalog_products RLS to allow Admin write access alongside Lead
drop policy if exists "Lead insert" on catalog_products;
create policy "Lead and admin insert" on catalog_products for insert
  with check (get_my_role() in ('lead', 'admin'));

drop policy if exists "Lead update" on catalog_products;
create policy "Lead and admin update" on catalog_products for update
  using (get_my_role() in ('lead', 'admin'));

drop policy if exists "Lead delete" on catalog_products;
create policy "Lead and admin delete" on catalog_products for delete
  using (get_my_role() in ('lead', 'admin'));
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
  console.log("✓ Design stage promotion & catalog permissions fixed:", body);
}

main();
