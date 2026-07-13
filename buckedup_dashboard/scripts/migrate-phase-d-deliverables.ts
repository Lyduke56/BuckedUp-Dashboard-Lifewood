/**
 * Phase D migration: per-stage deliverables + Lead QA/QC review.
 * See C:\Users\John Peter\.claude\plans\jaunty-conjuring-cook.md, Phase D.
 *
 *  - stage_deliverables table (Storyboarding/Scripting/Prompting only;
 *    Editing->Published reuses video_versions as-is).
 *  - RLS: Operator inserts own product's current-stage deliverable; Lead
 *    updates (reviews). Operator and Lead never touch the same row via the
 *    same verb, so plain RLS is enough (no column-level trigger needed).
 *  - review_stage_deliverable() RPC (security invoker): sets the decision
 *    and, on accept, advances products.status to the next stage.
 *  - stage-documents storage bucket (pdf/docx) + policies.
 *
 * Requires SUPABASE_ACCESS_TOKEN and NEXT_PUBLIC_SUPABASE_URL in .env.local.
 * Run: npx tsx scripts/migrate-phase-d-deliverables.ts
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
-- 1. stage_deliverables: one append-only row per submission (is_current
--    flags the latest, mirroring video_versions), for the 3 document/text
--    stages only. The Editing->Published leg keeps using video_versions.
create table if not exists stage_deliverables (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  stage text not null check (stage in ('Storyboarding', 'Scripting', 'Prompting')),
  kind text not null check (kind in ('file', 'text')),
  file_url text,
  text_content text,
  is_current boolean not null default true,
  submitted_by uuid references profiles(id) on delete set null,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references profiles(id) on delete set null,
  reviewed_at timestamptz,
  decision text not null default 'pending' check (decision in ('pending', 'accepted', 'rejected')),
  decision_note text
);

create index if not exists stage_deliverables_product_idx
  on stage_deliverables (product_id, stage);

alter table stage_deliverables enable row level security;

drop policy if exists "Public read" on stage_deliverables;
create policy "Public read" on stage_deliverables for select using (true);

-- Operator may only submit a deliverable for a product they own, and only
-- for the stage the product is currently in.
drop policy if exists "Operator submit own current stage" on stage_deliverables;
create policy "Operator submit own current stage" on stage_deliverables for insert
  with check (
    get_my_role() = 'operator'
    and submitted_by = auth.uid()
    and exists (
      select 1 from products p
      where p.id = product_id
        and p.owner_id = auth.uid()
        and p.status = stage
    )
  );

-- A Lead may also submit on a product's behalf (they have full catalog
-- power), so the pipeline never gets stuck if no operator is assigned.
drop policy if exists "Lead submit any" on stage_deliverables;
create policy "Lead submit any" on stage_deliverables for insert
  with check (get_my_role() = 'lead' and submitted_by = auth.uid());

-- Only a Lead reviews (updates decision/reviewed_by/etc.).
drop policy if exists "Lead review" on stage_deliverables;
create policy "Lead review" on stage_deliverables for update
  using (get_my_role() = 'lead');

-- Keep a single is_current row per (product, stage) on resubmission.
-- security definer because the operator who inserts a new row has no
-- update grant to un-flag their own prior rows.
create or replace function stage_deliverables_set_current()
returns trigger as $$
begin
  update stage_deliverables set is_current = false
    where product_id = new.product_id
      and stage = new.stage
      and id <> new.id
      and is_current;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists stage_deliverables_maintain_current on stage_deliverables;
create trigger stage_deliverables_maintain_current
  after insert on stage_deliverables
  for each row execute function stage_deliverables_set_current();

-- 2. review_stage_deliverable(): security invoker (matches
--    set_current_video_version()). Sets the decision, and on 'accepted'
--    advances products.status to the next stage via a hardcoded server-
--    side mapping so the client can't push an arbitrary stage.
create or replace function review_stage_deliverable(
  p_deliverable_id uuid,
  p_decision text,
  p_note text
)
returns void as $$
declare
  v_product_id uuid;
  v_stage text;
  v_next text;
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
    v_next := case v_stage
      when 'Storyboarding' then 'Scripting'
      when 'Scripting' then 'Prompting'
      when 'Prompting' then 'Editing'
      else null
    end;
    if v_next is not null then
      update products set status = v_next where id = v_product_id;
    end if;
  end if;
end;
$$ language plpgsql;

-- 2a. Let a controlled server-side function advance a stage past what the
--     caller's role could do directly. enforce_product_update_permissions()
--     is a BEFORE trigger, so it fires even inside a security-definer
--     function (security definer changes table privileges, not auth.uid()
--     / get_my_role()). A transaction-local GUC flag, set only by
--     submit_video_for_review() below, is the escape hatch — the trigger
--     honors it and returns early.
create or replace function enforce_product_update_permissions()
returns trigger as $$
declare
  my_role user_role := get_my_role();
begin
  -- Controlled stage-advance made by a trusted server function.
  if current_setting('app.allow_stage_advance', true) = 'on' then
    return new;
  end if;

  if my_role = 'lead' then
    return new;
  end if;

  if my_role = 'operator' then
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
      or new.status is distinct from old.status then
      raise exception 'Operators may only change the video URL (and claim ownership on upload)';
    end if;
    return new;
  end if;

  raise exception 'You do not have permission to edit this product';
end;
$$ language plpgsql;

-- 2b. submit_video_for_review(): the Editing-leg equivalent of an Operator
--     "submitting" — moves the product Editing -> In Review. security
--     definer + the GUC flag above so it can advance the stage, but
--     validates the caller owns the product (or is a Lead) and it's
--     actually in Editing. This is the only way an Operator advances a
--     stage, and it's a single fixed transition, not an arbitrary one.
create or replace function submit_video_for_review(p_product_id uuid)
returns void as $$
declare
  v_status text;
  v_owner uuid;
  v_role user_role := get_my_role();
begin
  select status, owner_id into v_status, v_owner
  from products where id = p_product_id;
  if v_status is null then
    raise exception 'product not found';
  end if;
  if v_role not in ('operator', 'lead') then
    raise exception 'not permitted';
  end if;
  if v_role = 'operator' and v_owner is distinct from auth.uid() then
    raise exception 'not your product';
  end if;
  if v_status <> 'Editing' then
    raise exception 'product is not in Editing';
  end if;
  perform set_config('app.allow_stage_advance', 'on', true);
  update products set status = 'In Review' where id = p_product_id;
end;
$$ language plpgsql security definer set search_path = public;

-- 3. stage-documents bucket: docx/pdf only, 25MB cap (docs, not raw
--    video). Prompting is text-only and stored in text_content, so it
--    never touches storage.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'stage-documents',
  'stage-documents',
  true,
  26214400,
  array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do nothing;

drop policy if exists "Public read stage docs" on storage.objects;
create policy "Public read stage docs" on storage.objects for select
  using (bucket_id = 'stage-documents');
drop policy if exists "Operator and lead upload stage docs" on storage.objects;
create policy "Operator and lead upload stage docs" on storage.objects for insert
  with check (bucket_id = 'stage-documents' and get_my_role() in ('operator', 'lead'));
drop policy if exists "Lead delete stage docs" on storage.objects;
create policy "Lead delete stage docs" on storage.objects for delete
  using (bucket_id = 'stage-documents' and get_my_role() = 'lead');

-- 4. Realtime so the review UI updates live (idempotent — adding a table
--    already in the publication errors otherwise).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'stage_deliverables'
  ) then
    alter publication supabase_realtime add table stage_deliverables;
  end if;
end $$;
`;

async function main() {
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;
  console.log("Running Phase D migration via Management API...");
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
