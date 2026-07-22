/**
 * Phase A migration: role rename (editor/approver/super-admin -> operator/admin/
 * super-admin), rewrite of enforce_product_update_permissions() for the new
 * grant shape, RLS policy updates (super-admin -> admin wherever it meant
 * "operational power"), and a bulk reset of every product's status to
 * 'Not Started' for the new 7-stage pipeline. See
 * C:\Users\John Peter\.claude\plans\jaunty-conjuring-cook.md, Phase A.
 *
 * Requires SUPABASE_ACCESS_TOKEN and NEXT_PUBLIC_SUPABASE_URL in .env.local.
 *
 * Run:
 *   npx tsx scripts/migrate-phase-a-roles-pipeline.ts
 */

import { readFileSync } from "fs";
import { join } from "path";

// Manually load .env.local (dotenv is not installed in devDependencies)
try {
  const envPath = join(process.cwd(), ".env.local");
  const raw = readFileSync(envPath, "utf-8");
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match) process.env[match[1]] = match[2].trim();
  }
} catch {
  // Ignore if .env.local doesn't exist
}

const PROJECT_REF = "iixxlgfxrctifelpixgz";
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  console.error("SUPABASE_ACCESS_TOKEN is not set in .env.local");
  process.exit(1);
}

const SQL = `
-- 1. Drop everything with a hard dependency on the \`user_role\` type
--    before rebuilding it: get_my_role() (its return type is user_role)
--    and every RLS policy whose compiled expression references it via
--    get_my_role(). plpgsql function bodies (handle_new_user(),
--    enforce_product_update_permissions(), enforce_profile_role_change())
--    do NOT register a hard type dependency for values used only inside
--    their body text, so those don't need dropping first -- only their
--    logic needs rewriting, done in step 4 below via CREATE OR REPLACE.
drop policy if exists "Super-Admin update" on profiles;
drop policy if exists "Super-Admin insert" on products;
drop policy if exists "Super-Admin delete" on products;
drop policy if exists "Editor and super-admin insert" on video_versions;
drop policy if exists "Editor and super-admin update" on video_versions;
drop policy if exists "Editor and super-admin upload videos" on storage.objects;
drop policy if exists "Editor and super-admin update videos" on storage.objects;
drop policy if exists "Super-Admin delete videos" on storage.objects;
drop policy if exists "Super-Admin insert" on production_plans;
drop policy if exists "Super-Admin update" on production_plans;
drop policy if exists "Super-Admin delete" on production_plans;
drop function if exists get_my_role();

-- 2. Enum rebuild: editor->operator (1:1), approver->admin (absorbed),
--    super-admin keeps its label with new (narrower) meaning.
drop type if exists user_role_new;
create type user_role_new as enum ('operator', 'admin', 'super-admin');

-- The column's existing default ('editor'::user_role) can't be
-- auto-cast to the new enum type -- drop it before the type change,
-- reapply the new default after.
alter table profiles alter column role drop default;

alter table profiles alter column role type user_role_new
  using (case role::text
           when 'editor' then 'operator'
           when 'approver' then 'admin'
           else role::text
         end)::user_role_new;

alter table profiles alter column role set default 'operator';

drop type user_role;
alter type user_role_new rename to user_role;

-- 3. Recreate get_my_role() (now against the renamed type) and every
--    policy dropped in step 1 -- super-admin-meant-power ones become admin,
--    editor-meant-production-access ones become operator; profiles'
--    "Super-Admin update" keeps its original meaning (only super-admins change roles).
create or replace function get_my_role()
returns user_role as $$
  select role from public.profiles where id = auth.uid();
$$ language sql security definer stable;

create policy "Super-Admin update" on profiles for update
  using (get_my_role() = 'super-admin');

-- 4. handle_new_user(): first signup still becomes super-admin, everyone else
--    now defaults to operator (was editor).
create or replace function handle_new_user()
returns trigger as $$
declare
  is_first boolean;
begin
  select not exists(select 1 from public.profiles) into is_first;
  insert into public.profiles (id, email, role)
  values (new.id, new.email, (case when is_first then 'super-admin' else 'operator' end)::user_role);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- 5. enforce_product_update_permissions(): full rewrite for the new grant
--    shape (admin = unrestricted, operator = video_url/owner_id only,
--    super-admin = no product-column access at all).
create or replace function enforce_product_update_permissions()
returns trigger as $$
declare
  my_role user_role := get_my_role();
begin
  if my_role = 'admin' then
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

-- 6. Recreate the remaining policies dropped in step 1 with their new
--    role names -- super-admin-meant-power ones become admin, editor-meant-
--    production-access ones become operator. (products' policies were
--    already recreated implicitly-adjacent above; production_plans'
--    "Admin update" is new -- the old set never had an update-vs-insert
--    split, this just names each verb explicitly.)
create policy "Admin insert" on products for insert
  with check (get_my_role() = 'admin');
create policy "Admin delete" on products for delete
  using (get_my_role() = 'admin');

create policy "Operator and admin insert" on video_versions for insert
  with check (get_my_role() in ('operator', 'admin'));
create policy "Operator and admin update" on video_versions for update
  using (get_my_role() in ('operator', 'admin'));

create policy "Operator and admin upload videos" on storage.objects for insert
  with check (bucket_id = 'videos' and get_my_role() in ('operator', 'admin'));
create policy "Operator and admin update videos" on storage.objects for update
  using (bucket_id = 'videos' and get_my_role() in ('operator', 'admin'));
create policy "Admin delete videos" on storage.objects for delete
  using (bucket_id = 'videos' and get_my_role() = 'admin');

create policy "Admin insert" on production_plans for insert
  with check (get_my_role() = 'admin');
create policy "Admin update" on production_plans for update
  using (get_my_role() = 'admin');
create policy "Admin delete" on production_plans for delete
  using (get_my_role() = 'admin');

-- 7. Bulk reset every product to Not Started for the new 7-stage pipeline
--    (Not Started -> Storyboarding -> Scripting -> Prompting -> Editing ->
--    In Review -> Published). A SQL-editor/Management-API session has no
--    auth.uid(), so get_my_role() returns null and
--    enforce_product_update_permissions() would otherwise fail-closed and
--    reject this update -- bracket it with a trigger disable/enable.
-- Let products_log_status_change fire normally so every product gets a
-- fresh product_status_history row (useStageAge should read 0 days
-- in-stage immediately after this migration).
alter table products disable trigger products_enforce_update_permissions;
update products set status = 'Not Started';
alter table products enable trigger products_enforce_update_permissions;
`;

async function main() {
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

  console.log("Running Phase A migration via Management API...");
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
