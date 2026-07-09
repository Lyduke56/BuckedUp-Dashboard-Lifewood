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
-- This is an internal Lifewood tool: `editor` = production staff (moves
-- the pipeline stage), `approver` = Lifewood leadership (sets
-- review_status/rejection_reason only), `admin` = full access + manages
-- roles. The first person ever to sign in becomes admin automatically.

create extension if not exists "pgcrypto";

create type user_role as enum ('editor', 'approver', 'admin');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role user_role not null default 'editor',
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
-- everyone after defaults to editor and gets promoted by an admin later.
create or replace function handle_new_user()
returns trigger as $$
declare
  is_first boolean;
begin
  select not exists(select 1 from public.profiles) into is_first;
  insert into public.profiles (id, email, role)
  values (new.id, new.email, (case when is_first then 'admin' else 'editor' end)::user_role);
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
  video_url text,
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

-- Column-level permission split: editors run production (everything
-- except the review columns), approvers only ever touch the review
-- columns, admins are unrestricted. RLS alone can't express "this role
-- may update this row but only these columns," so this is a trigger.
create or replace function enforce_product_update_permissions()
returns trigger as $$
declare
  my_role user_role := get_my_role();
begin
  if my_role = 'admin' then
    return new;
  end if;

  if my_role = 'approver' then
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
      or new.status is distinct from old.status
      or new.video_url is distinct from old.video_url then
      raise exception 'Approvers may only change review_status and rejection_reason';
    end if;
    return new;
  end if;

  -- editor (or any other authenticated role): production fields only.
  if new.review_status is distinct from old.review_status
    or new.rejection_reason is distinct from old.rejection_reason then
    raise exception 'Only approvers and admins can set review_status/rejection_reason';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger products_enforce_update_permissions
  before update on products
  for each row
  execute function enforce_product_update_permissions();

-- Row Level Security: reads stay public (the dashboard is open-viewing,
-- same as it's always been); writes require an authenticated session,
-- with the role-based split above enforced by the trigger. Delete is
-- admin-only — the one genuinely irreversible action.
alter table products enable row level security;
alter table issues enable row level security;

create policy "Public read" on products for select using (true);
create policy "Public read" on issues for select using (true);

create policy "Editor and admin insert" on products for insert
  with check (get_my_role() in ('editor', 'admin'));
create policy "Authenticated update" on products for update
  using (auth.role() = 'authenticated');
create policy "Admin delete" on products for delete
  using (get_my_role() = 'admin');

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

-- Realtime: the dashboard subscribes to postgres_changes on these tables
-- so multiple editors see writes live, instead of polling.
alter publication supabase_realtime add table products;
alter publication supabase_realtime add table issues;
alter publication supabase_realtime add table profiles;
alter publication supabase_realtime add table product_status_history;
