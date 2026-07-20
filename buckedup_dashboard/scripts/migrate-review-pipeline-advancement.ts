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
-- 1. Ensure enforce_product_update_permissions allows both Lead and Admin unrestricted product column updates
create or replace function enforce_product_update_permissions()
returns trigger as $$
declare
  my_role user_role := get_my_role();
  is_claim boolean;
  is_unclaim boolean;
begin
  if auth.uid() is null
     or auth.role() = 'service_role'
     or current_setting('app.allow_stage_advance', true) = 'on' then
    return new;
  end if;

  if my_role in ('lead', 'admin') then
    return new;
  end if;

  if my_role = 'operator' then
    is_claim := (old.owner_id is null and new.owner_id = auth.uid() and old.status = 'Not Started' and new.status = 'Design');
    is_unclaim := (old.owner_id = auth.uid() and new.owner_id is null and (old.status = 'Design' or old.status = 'Not Started') and new.status = 'Not Started');

    if is_claim or is_unclaim then
      if new.rank is distinct from old.rank
        or new.name is distinct from old.name
        or new.category is distinct from old.category
        or new.subcategory is distinct from old.subcategory
        or new.content_type is distinct from old.content_type
        or new.language is distinct from old.language
        or new.product_url is distinct from old.product_url
        or new.content_angle is distinct from old.content_angle
        or new.owner is distinct from old.owner
        or new.publish_date is distinct from old.publish_date
        or new.review_status is distinct from old.review_status
        or new.rejection_reason is distinct from old.rejection_reason
        or new.thumbnail_url is distinct from old.thumbnail_url
        or new.delivery_type is distinct from old.delivery_type then
        raise exception 'Operators may not modify other fields during claim/unclaim';
      end if;
      return new;
    end if;

    if new.rank is distinct from old.rank
      or new.name is distinct from old.name
      or new.category is distinct from old.category
      or new.subcategory is distinct from old.subcategory
      or new.content_type is distinct from old.content_type
      or new.language is distinct from old.language
      or new.product_url is distinct from old.product_url
      or new.content_angle is distinct from old.content_angle
      or new.owner is distinct from old.owner
      or new.owner_id is distinct from old.owner_id
      or new.publish_date is distinct from old.publish_date
      or new.review_status is distinct from old.review_status
      or new.rejection_reason is distinct from old.rejection_reason
      or new.status is distinct from old.status
      or new.thumbnail_url is distinct from old.thumbnail_url
      or new.delivery_type is distinct from old.delivery_type then
      raise exception 'Operators may only change the video URL';
    end if;
    return new;
  end if;

  raise exception 'You do not have permission to edit this product';
end;
$$ language plpgsql;

-- 2. Update review_stage_deliverable so when both deliverables are accepted, product moves automatically to Production. When rejected, it stays in Design and records rejection_reason.
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

  if p_decision = 'rejected' then
    perform set_config('app.allow_stage_advance', 'on', true);
    update products
    set review_status = 'Rejected',
        rejection_reason = p_note
    where id = v_product_id;
  end if;

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
        update products
        set status = 'Production',
            review_status = 'Accepted',
            rejection_reason = null
        where id = v_product_id;
      else
        perform set_config('app.allow_stage_advance', 'on', true);
        update products
        set review_status = 'Pending',
            rejection_reason = null
        where id = v_product_id;
      end if;
    end if;
  end if;
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
  console.log("✓ Review pipeline advancement fixed:", body);
}

main();
