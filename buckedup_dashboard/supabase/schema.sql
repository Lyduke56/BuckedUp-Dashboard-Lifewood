-- BuckedUp AIGC Video Production Monitor — Supabase schema
--
-- Run this once, in the Supabase SQL Editor, against a fresh project.
-- This replaces the Google Sheet as the source of truth: `products` is
-- the Video Content Plan (one row per requested product — every real row
-- so far has had exactly one video item, so VideoItem's fields are
-- flattened directly onto the product row rather than a separate table),
-- and `issues` replaces the local data/issues.json file the dashboard
-- used before this migration.
--
-- This is an internal Lifewood tool: `operator` = production staff (does
-- the grunt work — uploads deliverables per stage, reports/resolves
-- issues, never creates listings and never moves the pipeline stage
-- directly), `lead` = the operational owner (fusion of the old approver +
-- old admin's catalog powers — creates listings/products, configures the
-- production plan, reviews Operator-submitted deliverables, and is the
-- only role that actually moves a product's stage), `admin` = governance
-- only (manages Lead/Operator user accounts, no product-catalog access at
-- all). The first person ever to sign in becomes admin automatically.

create extension if not exists "pgcrypto";

create type user_role as enum ('operator', 'lead', 'admin');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role user_role not null default 'operator',
  -- Set true only by the admin-created-account flow (see
  -- app/api/admin/create-user/route.ts) so the new user is forced through
  -- ForcePasswordChangeView on their first login instead of using the
  -- admin-issued temporary password indefinitely.
  must_change_password boolean not null default false,
  created_at timestamptz not null default now()
);

-- Security definer: safe to call from any RLS policy without recursing
-- into profiles' own RLS (which would otherwise re-trigger this check).
create or replace function get_my_role()
returns user_role as $$
  select role from public.profiles where id = auth.uid();
$$ language sql security definer stable;

-- Auto-provision a profile on signup. First-ever signup becomes admin
-- (there's no other way to get an admin account before one exists);
-- everyone after defaults to operator and gets promoted to lead/admin by
-- an admin later.
create or replace function handle_new_user()
returns trigger as $$
declare
  is_first boolean;
begin
  select not exists(select 1 from public.profiles) into is_first;
  insert into public.profiles (id, email, role)
  values (new.id, new.email, (case when is_first then 'admin' else 'operator' end)::user_role);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Only admins may change a profile's role — stops self-promotion even
-- though profiles update is otherwise open to the row's own owner.
create or replace function enforce_profile_role_change()
returns trigger as $$
begin
  if new.role is distinct from old.role and get_my_role() <> 'admin' then
    raise exception 'Only admins can change roles';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger profiles_enforce_role_change
  before update on profiles
  for each row
  execute function enforce_profile_role_change();

alter table profiles enable row level security;

create policy "Authenticated read" on profiles for select
  using (auth.role() = 'authenticated');
create policy "Admin update" on profiles for update
  using (get_my_role() = 'admin');

-- "Admin update" above is the ONLY update policy on profiles — nobody,
-- not even a user editing their own row, can update it unless their own
-- role is admin. A non-admin's self-service "I changed my password,
-- clear my flag" action needs its own narrow escape hatch, not a broader
-- policy change: deliberately parameterless, only ever touches
-- auth.uid()'s own row, so "can't target another user's flag" is true by
-- construction.
create or replace function clear_must_change_password()
returns void as $$
begin
  update profiles
  set must_change_password = false
  where id = auth.uid();
end;
$$ language plpgsql security definer set search_path = public;

create table products (
  id uuid primary key default gen_random_uuid(),
  rank integer not null unique,
  name text not null,
  category text not null,
  subcategory text not null,
  content_type text,
  language text not null default 'English',
  product_url text,
  content_angle text,
  owner text,
  owner_id uuid references profiles(id) on delete set null,
  publish_date date,
  review_status text,
  rejection_reason text,
  status text not null default 'Not Started',
  -- 'pipeline' = normal content, goes through all 7 stages. 'link' = an
  -- external URL/asset counted as Published the moment it's created,
  -- bypassing the pipeline entirely (a Lead sets status='Published' +
  -- video_url at insert time; no trigger special-case is needed since
  -- enforce_product_update_permissions() governs UPDATEs, not INSERTs).
  delivery_type text not null default 'pipeline'
    check (delivery_type in ('pipeline', 'link')),
  video_url text,
  thumbnail_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table issues (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  description text not null,
  severity text not null check (severity in ('low', 'medium', 'high')),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
);

-- Keep updated_at current on every edit, instead of relying on callers
-- to remember to set it.
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger products_set_updated_at
  before update on products
  for each row
  execute function set_updated_at();

-- Column-level permission split: operators are execution-only (video URL
-- + claiming ownership on upload, nothing else — they never move the
-- pipeline stage or touch catalog metadata), leads are unrestricted
-- (catalog metadata, stage moves, review columns — leads absorb both the
-- old approver's review power and the old admin's catalog power), admins
-- get no product-column access at all (governance/user-management only).
-- RLS alone can't express "this role may update this row but only these
-- columns," so this is a trigger.
--
-- Stage advancement itself is Lead-driven: a Lead moves `status` directly
-- (ProductFormModal) or via accepting a submitted deliverable (see
-- review_stage_deliverable() once Phase D adds it) — Operators never set
-- `status` themselves, they only ever submit the deliverable a Lead
-- reviews.
create or replace function enforce_product_update_permissions()
returns trigger as $$
declare
  my_role user_role := get_my_role();
begin
  -- Allow system operations, backend service-role scripts, direct DB migrations
  -- (where auth.uid() is null or role is service_role), or controlled server
  -- functions (app.allow_stage_advance).
  if auth.uid() is null
     or auth.role() = 'service_role'
     or current_setting('app.allow_stage_advance', true) = 'on' then
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
      or new.status is distinct from old.status
      or new.thumbnail_url is distinct from old.thumbnail_url
      or new.delivery_type is distinct from old.delivery_type then
      raise exception 'Operators may only change the video URL (and claim ownership via owner_id)';
    end if;
    return new;
  end if;

  -- admin: governance-only — no product column is writable, regardless of
  -- value. Any other/unrecognized role also falls through here and is
  -- denied — fail closed.
  raise exception 'You do not have permission to edit this product';
end;
$$ language plpgsql;

create trigger products_enforce_update_permissions
  before update on products
  for each row
  execute function enforce_product_update_permissions();

-- Row Level Security: reads stay public (the dashboard is open-viewing,
-- same as it's always been); writes require an authenticated session,
-- with the role-based split above enforced by the trigger. Insert and
-- delete are lead-only — creating a product requires the full catalog
-- fields an operator can't touch, and delete is the one genuinely
-- irreversible action (admins are governance-only and never write here).
alter table products enable row level security;
alter table issues enable row level security;

create policy "Public read" on products for select using (true);
create policy "Public read" on issues for select using (true);

create policy "Lead insert" on products for insert
  with check (get_my_role() = 'lead');
create policy "Authenticated update" on products for update
  using (auth.role() = 'authenticated');
create policy "Lead delete" on products for delete
  using (get_my_role() = 'lead');

create policy "Authenticated insert" on issues for insert
  with check (auth.role() = 'authenticated');
create policy "Authenticated update" on issues for update
  using (auth.role() = 'authenticated');

-- Stage-aging history: plain updated_at bumps on *any* edit (owner change,
-- content angle tweak), not just a stage change, so it can't answer "how
-- long has this been in its current stage." This table can, and doubles
-- as the seed for a future historical cycle-time chart once enough
-- transitions accumulate.
create table product_status_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  status text not null,
  entered_at timestamptz not null default now()
);

-- Security definer so logging never depends on the calling role having
-- direct insert rights on the history table — it shouldn't have any.
create or replace function log_status_change()
returns trigger as $$
begin
  if (tg_op = 'INSERT') or (new.status is distinct from old.status) then
    insert into product_status_history (product_id, status, entered_at)
    values (new.id, new.status, now());
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger products_log_status_change
  after insert or update on products
  for each row
  execute function log_status_change();

alter table product_status_history enable row level security;
create policy "Public read" on product_status_history for select using (true);

-- In-app notifications. No client insert policy at all — rows only ever
-- come from the security-definer trigger functions below, reacting to
-- real events. Recipients can only see/update their own rows.
create table notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references profiles(id) on delete cascade,
  type text not null check (type in ('issue_reported', 'rejected', 'assigned')),
  message text not null,
  product_id uuid references products(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table notifications enable row level security;

create policy "Own notifications" on notifications for select
  using (recipient_id = auth.uid());
create policy "Mark own notifications read" on notifications for update
  using (recipient_id = auth.uid());

create or replace function notify_issue_reported()
returns trigger as $$
declare
  v_owner_id uuid;
  v_name text;
begin
  select owner_id, name into v_owner_id, v_name from products where id = new.product_id;
  if v_owner_id is not null and v_owner_id <> auth.uid() then
    insert into notifications (recipient_id, type, message, product_id)
    values (v_owner_id, 'issue_reported', 'New issue reported on "' || v_name || '"', new.product_id);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger issues_notify_owner
  after insert on issues
  for each row
  execute function notify_issue_reported();

create or replace function notify_product_changes()
returns trigger as $$
begin
  if new.review_status = 'Rejected'
    and new.review_status is distinct from old.review_status
    and new.owner_id is not null and new.owner_id <> auth.uid() then
    insert into notifications (recipient_id, type, message, product_id)
    values (new.owner_id, 'rejected', '"' || new.name || '" was rejected', new.id);
  end if;

  if new.owner_id is distinct from old.owner_id
    and new.owner_id is not null and new.owner_id <> auth.uid() then
    insert into notifications (recipient_id, type, message, product_id)
    values (new.owner_id, 'assigned', 'You were assigned "' || new.name || '"', new.id);
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger products_notify_changes
  after update on products
  for each row
  execute function notify_product_changes();

-- Video revision history — additive alongside products.video_url, not a
-- replacement for it. Every existing consumer (VideoModal, the table's
-- progress/watch behavior) keeps reading products.video_url unchanged;
-- set_current_video_version() below keeps it in sync with the latest
-- version so nothing else needs to change to pick this up.
create table video_versions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  video_url text not null,
  note text,
  is_current boolean not null default false,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table video_versions enable row level security;

create policy "Public read" on video_versions for select using (true);
create policy "Operator and lead insert" on video_versions for insert
  with check (get_my_role() in ('operator', 'lead'));
create policy "Operator and lead update" on video_versions for update
  using (get_my_role() in ('operator', 'lead'));

-- security invoker (the default) so this runs under the caller's own RLS —
-- an admin (governance-only, no operator/lead grant) calling this gets
-- rejected by video_versions' insert policy, same as if they'd tried it
-- directly.
create or replace function set_current_video_version(
  p_product_id uuid,
  p_video_url text,
  p_note text
)
returns void as $$
begin
  update video_versions set is_current = false
    where product_id = p_product_id and is_current = true;

  insert into video_versions (product_id, video_url, note, is_current, created_by)
  values (p_product_id, p_video_url, p_note, true, auth.uid());

  update products 
  set 
    video_url = p_video_url,
    owner_id = coalesce(owner_id, auth.uid())
  where id = p_product_id;
end;
$$ language plpgsql;

-- Video files upload directly here (no more pasting Google Drive links) —
-- public bucket since product videos are already public-read via
-- video_versions/products, capped at 2GB per file to allow real raw cuts,
-- restricted to actual video MIME types.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'videos',
  'videos',
  true,
  2147483648,
  array['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska']
)
on conflict (id) do nothing;

create policy "Public read videos" on storage.objects for select
  using (bucket_id = 'videos');
create policy "Operator and lead upload videos" on storage.objects for insert
  with check (bucket_id = 'videos' and get_my_role() in ('operator', 'lead'));
create policy "Operator and lead update videos" on storage.objects for update
  using (bucket_id = 'videos' and get_my_role() in ('operator', 'lead'));
create policy "Lead delete videos" on storage.objects for delete
  using (bucket_id = 'videos' and get_my_role() = 'lead');

-- Per-stage deliverables (QA/QC): the document/text artifacts an Operator
-- submits for the three pre-video stages (Storyboarding/Scripting/
-- Prompting), which a Lead reviews. Append-only with is_current, mirroring
-- video_versions, so resubmissions keep a history. The Editing->Published
-- leg deliberately reuses video_versions instead of this table — that's
-- the one stage whose deliverable is a video.
create table stage_deliverables (
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

create index stage_deliverables_product_idx
  on stage_deliverables (product_id, stage);

alter table stage_deliverables enable row level security;

create policy "Public read" on stage_deliverables for select using (true);

-- Operator may only submit for a product they own, and only for the stage
-- the product is currently in. A Lead may submit on any product's behalf.
-- Operator and Lead never touch the same row via the same verb (Operator
-- only inserts, Lead only updates), so plain RLS is enough — no
-- column-level trigger like products needs.
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
create policy "Lead submit any" on stage_deliverables for insert
  with check (get_my_role() = 'lead' and submitted_by = auth.uid());
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

create trigger stage_deliverables_maintain_current
  after insert on stage_deliverables
  for each row execute function stage_deliverables_set_current();

-- review_stage_deliverable(): security invoker (matches
-- set_current_video_version()). Sets the decision, and on 'accepted'
-- advances products.status to the next stage via a hardcoded server-side
-- mapping — this is the real gate on stage advancement for these three
-- stages (the client can't push an arbitrary stage). Rejecting only
-- updates the deliverable row; the product stays where it is.
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

-- submit_video_for_review(): the Editing-leg equivalent of an Operator
-- "submitting" — moves the product Editing -> In Review. security definer
-- plus the app.allow_stage_advance flag (honored by
-- enforce_product_update_permissions above) so it can advance the stage,
-- but validates the caller owns the product (or is a Lead) and it's
-- actually in Editing. This is the only way an Operator advances a stage,
-- and it's a single fixed transition, not an arbitrary one.
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

-- Storage for the document/text deliverables above — docx/pdf only, 25MB
-- cap (documents, not raw footage). Prompting is text-only and stored in
-- stage_deliverables.text_content, so it never touches storage.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'stage-documents',
  'stage-documents',
  true,
  26214400,
  array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do nothing;

create policy "Public read stage docs" on storage.objects for select
  using (bucket_id = 'stage-documents');
create policy "Operator and lead upload stage docs" on storage.objects for insert
  with check (bucket_id = 'stage-documents' and get_my_role() in ('operator', 'lead'));
create policy "Lead delete stage docs" on storage.objects for delete
  using (bucket_id = 'stage-documents' and get_my_role() = 'lead');

-- Product thumbnails — small images shown in the List/Grid views. Set at
-- listing creation/edit time, a Lead-exclusive action, so writes are
-- lead-only. Stored in products.thumbnail_url.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'thumbnails',
  'thumbnails',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

create policy "Public read thumbnails" on storage.objects for select
  using (bucket_id = 'thumbnails');
create policy "Lead upload thumbnails" on storage.objects for insert
  with check (bucket_id = 'thumbnails' and get_my_role() = 'lead');
create policy "Lead update thumbnails" on storage.objects for update
  using (bucket_id = 'thumbnails' and get_my_role() = 'lead');
create policy "Lead delete thumbnails" on storage.objects for delete
  using (bucket_id = 'thumbnails' and get_my_role() = 'lead');

-- Production plan: the corporate-level targets the pipeline is measured
-- against — daily throughput, per-stage/language/category breakdowns, and
-- the delivery deadline. Replaces the hardcoded placeholder constants
-- lib/data.ts carried since before this was a real database (their own
-- comments anticipated exactly this: "should become a real setting ...
-- once one exists"). Per-stage/language/category targets are jsonb
-- rather than child tables — they're small lead-edited config maps with
-- open-ended keys (language especially isn't a fixed enum), not
-- high-volume relational data.
create table production_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  total_video_target integer not null default 0,
  start_date date not null,
  deadline date not null,
  language_targets jsonb not null default '{}'::jsonb,
  category_targets jsonb not null default '{}'::jsonb,
  notes text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Only one active plan at a time — the app always reads "the" plan via
-- is_active = true, so this is a DB-enforced invariant, not a UI convention.
create unique index production_plans_one_active
  on production_plans (is_active)
  where is_active;

create trigger production_plans_set_updated_at
  before update on production_plans
  for each row
  execute function set_updated_at();

alter table production_plans enable row level security;

create policy "Public read" on production_plans for select using (true);
create policy "Lead insert" on production_plans for insert
  with check (get_my_role() = 'lead');
create policy "Lead update" on production_plans for update
  using (get_my_role() = 'lead');
create policy "Lead delete" on production_plans for delete
  using (get_my_role() = 'lead');

-- Durable audit trail for Bucky (the AI assistant)'s mutating tool calls —
-- who, what tool, with what arguments, and what happened. Append-only, no
-- update/delete policy, same convention as notifications/product_status_history.
-- Two write paths populate this: app/api/bucky/chat/route.ts's
-- onToolExecutionEnd callback (success/error, server-side, awaited) and
-- BuckyWidget.tsx's Cancel button (denied, client-side, fire-and-forget —
-- a denied tool call never reaches onToolExecutionEnd at all, since it
-- never actually executes). See lib/bucky/tools/metadata.ts for which
-- tools are "mutating" (only those get logged; read tools are skipped).
create table bucky_audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  role user_role not null,
  tool_name text not null,
  status text not null check (status in ('success', 'error', 'denied')),
  input jsonb not null default '{}'::jsonb,
  result_summary jsonb,
  error_message text,
  call_id text,
  approval_id text,
  created_at timestamptz not null default now()
);

-- Prevents a rare double-click on Cancel from producing two denied rows
-- for the same approval (the client-side insert uses upsert + this index).
-- Deliberately NOT partial (no "where approval_id is not null") — Postgres
-- allows unlimited NULLs in a unique index (NULL is never considered equal
-- to another NULL for uniqueness), so a plain index already does the right
-- thing for the server-side rows that never set approval_id at all. A
-- partial index was tried first and rejected: PostgREST's upsert(onConflict)
-- resolves to a plain "ON CONFLICT (approval_id)" clause, which Postgres
-- can't match against a partial index's restricted arbiter — every denial
-- insert failed with "42P10: no unique or exclusion constraint matching
-- the ON CONFLICT specification" until this was made non-partial.
create unique index bucky_audit_log_approval_id_idx
  on bucky_audit_log (approval_id);
create index bucky_audit_log_user_idx on bucky_audit_log (user_id, created_at desc);
create index bucky_audit_log_tool_idx on bucky_audit_log (tool_name, created_at desc);

alter table bucky_audit_log enable row level security;

-- Same posture as issues' "Authenticated insert" policy: this trusts that
-- only Bucky's own code paths actually call insert (RLS can't verify
-- "a real tool execution happened"), same as the rest of this schema.
create policy "Own inserts" on bucky_audit_log for insert
  with check (user_id = auth.uid());
create policy "Admin read" on bucky_audit_log for select
  using (get_my_role() = 'admin');

-- Backs Bucky's chat rate limit (lib/bucky/rateLimit.ts) — one row per
-- chat request (every message, not just mutating tool calls, since even a
-- read-only question costs real usage against the manager's $5-capped
-- OpenRouter key). Self-cleaning by construction: the rate-limit check
-- deletes a user's own rows older than the rolling window before ever
-- counting them, so this table never holds more than a handful of rows
-- per currently-active user — no separate cleanup job needed.
create table bucky_rate_limit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index bucky_rate_limit_log_user_created_idx
  on bucky_rate_limit_log (user_id, created_at desc);

alter table bucky_rate_limit_log enable row level security;

create policy "Own select" on bucky_rate_limit_log for select
  using (user_id = auth.uid());
create policy "Own insert" on bucky_rate_limit_log for insert
  with check (user_id = auth.uid());
create policy "Own delete" on bucky_rate_limit_log for delete
  using (user_id = auth.uid());

-- Realtime: the dashboard subscribes to postgres_changes on these tables
-- so multiple editors see writes live, instead of polling.
alter publication supabase_realtime add table products;
alter publication supabase_realtime add table issues;
alter publication supabase_realtime add table profiles;
alter publication supabase_realtime add table product_status_history;
alter publication supabase_realtime add table notifications;
alter publication supabase_realtime add table production_plans;
alter publication supabase_realtime add table stage_deliverables;
