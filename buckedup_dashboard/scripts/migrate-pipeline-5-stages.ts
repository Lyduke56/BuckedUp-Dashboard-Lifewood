/**
 * Migration script for refactoring AIGC Video Production Pipeline to 5 stages.
 *
 *  - Recreate RLS policies on stage_deliverables for Storyboarding and Scripting under the Design stage.
 *  - Update review_stage_deliverable() to check and transition from Design to Production.
 *  - Update submit_video_for_review() to validate Production status and that at least one video version exists.
 *  - Migrate existing stages in products and product_status_history.
 *
 * Run: npx tsx scripts/migrate-pipeline-5-stages.ts
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
-- 1. Update RLS policy on stage_deliverables for Operator inserts
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
          stage in ('Storyboarding', 'Scripting') and p.status = 'Design'
        )
    )
  );

-- 2. Recreate review_stage_deliverable function for Design -> Production transition
create or replace function review_stage_deliverable(
  p_deliverable_id uuid,
  p_decision text,
  p_note text
)
returns void as $$
declare
  v_product_id uuid;
  v_stage text;
  v_has_storyboard boolean;
  v_has_script boolean;
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
    if v_stage in ('Storyboarding', 'Scripting') then
      select exists (
        select 1 from stage_deliverables
        where product_id = v_product_id
          and stage = 'Storyboarding'
          and is_current = true
          and decision = 'accepted'
      ) into v_has_storyboard;

      select exists (
        select 1 from stage_deliverables
        where product_id = v_product_id
          and stage = 'Scripting'
          and is_current = true
          and decision = 'accepted'
      ) into v_has_script;

      if v_has_storyboard and v_has_script then
        update products set status = 'Production' where id = v_product_id;
      end if;
    end if;
  end if;
end;
$$ language plpgsql;

-- 3. Recreate submit_video_for_review function checking for video version in Production
create or replace function submit_video_for_review(p_product_id uuid)
returns void as $$
declare
  v_status text;
  v_owner uuid;
  v_role user_role := get_my_role();
  v_has_video boolean;
begin
  select status, owner_id into v_status, v_owner
  from products where id = p_product_id;
  if v_status is null then
    raise exception 'product not found';
  end if;
  if v_role not in ('operator', 'admin') then
    raise exception 'not permitted';
  end if;
  if v_role = 'operator' and v_owner is distinct from auth.uid() then
    raise exception 'not your product';
  end if;
  if v_status <> 'Production' then
    raise exception 'product is not in Production';
  end if;

  -- Check if at least one video version has been uploaded
  select exists (
    select 1 from video_versions
    where product_id = p_product_id
  ) into v_has_video;

  if not v_has_video then
    raise exception 'You must upload at least one video version before submitting for review';
  end if;

  perform set_config('app.allow_stage_advance', 'on', true);
  update products set status = 'In Review' where id = p_product_id;
end;
$$ language plpgsql security definer set search_path = public;

-- 4. Migrate existing product stages
update products
set status = case
  when status in ('Storyboarding', 'Scripting') then 'Design'
  when status in ('Prompting', 'Editing') then 'Production'
  else status
end;

-- 5. Migrate existing product status history records
update product_status_history
set status = case
  when status in ('Storyboarding', 'Scripting') then 'Design'
  when status in ('Prompting', 'Editing') then 'Production'
  else status
end;
`;

async function main() {
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;
  console.log("Running 5-stage pipeline migration via Management API...");
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
