import { readFileSync } from "fs";
import { join } from "path";

// Manually load .env.local (same pattern as other migration scripts)
try {
  const envPath = join(process.cwd(), ".env.local");
  const raw = readFileSync(envPath, "utf-8");
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match) process.env[match[1]] = match[2].trim();
  }
} catch {
  // Ignore
}

const PROJECT_REF = "iixxlgfxrctifelpixgz";
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  console.error("SUPABASE_ACCESS_TOKEN is not set in .env.local");
  process.exit(1);
}

const SQL = `
-- ============================================================
-- 1. enforce_product_update_permissions — add super-admin passthrough
-- ============================================================
create or replace function enforce_product_update_permissions()
returns trigger as $$
declare
  my_role user_role := get_my_role();
begin
  if auth.uid() is null
     or auth.role() = 'service_role'
     or current_setting('app.allow_stage_advance', true) = 'on' then
    return new;
  end if;

  if my_role = 'admin' or my_role = 'super-admin' then
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

  raise exception 'You do not have permission to edit this product';
end;
$$ language plpgsql;

-- ============================================================
-- 2. products RLS — expand INSERT and DELETE to include super-admin
-- ============================================================
drop policy if exists "Admin insert" on products;
create policy "Admin and super-admin insert" on products for insert
  with check (get_my_role() in ('admin', 'super-admin'));

drop policy if exists "Admin delete" on products;
create policy "Admin and super-admin delete" on products for delete
  using (get_my_role() in ('admin', 'super-admin'));

-- ============================================================
-- 3. stage_deliverables RLS — expand to include super-admin
-- ============================================================
drop policy if exists "Admin submit any" on stage_deliverables;
create policy "Admin and super-admin submit any" on stage_deliverables for insert
  with check (get_my_role() in ('admin', 'super-admin') and submitted_by = auth.uid());

drop policy if exists "Admin review" on stage_deliverables;
create policy "Admin and super-admin review" on stage_deliverables for update
  using (get_my_role() in ('admin', 'super-admin'));

-- ============================================================
-- 4. video_versions RLS — expand to include super-admin
-- ============================================================
drop policy if exists "Operator and admin insert" on video_versions;
create policy "Operator, admin, and super-admin insert" on video_versions for insert
  with check (get_my_role() in ('operator', 'admin', 'super-admin'));

drop policy if exists "Operator and admin update" on video_versions;
create policy "Operator, admin, and super-admin update" on video_versions for update
  using (get_my_role() in ('operator', 'admin', 'super-admin'));

-- ============================================================
-- 5. Storage "videos" bucket — expand upload/update/delete to super-admin
-- ============================================================
drop policy if exists "Operator and admin upload videos" on storage.objects;
create policy "Operator, admin, and super-admin upload videos" on storage.objects for insert
  with check (bucket_id = 'videos' and get_my_role() in ('operator', 'admin', 'super-admin'));

drop policy if exists "Operator and admin update videos" on storage.objects;
create policy "Operator, admin, and super-admin update videos" on storage.objects for update
  using (bucket_id = 'videos' and get_my_role() in ('operator', 'admin', 'super-admin'));

drop policy if exists "Admin delete videos" on storage.objects;
create policy "Super-Admin delete videos" on storage.objects for delete
  using (bucket_id = 'videos' and get_my_role() in ('admin', 'super-admin'));

-- ============================================================
-- 6. production_plans — shift write access from admin to super-admin
-- ============================================================
drop policy if exists "Admin insert" on production_plans;
drop policy if exists "Admin update" on production_plans;
drop policy if exists "Admin delete" on production_plans;

create policy "Super-Admin insert" on production_plans for insert
  with check (get_my_role() = 'super-admin');
create policy "Super-Admin update" on production_plans for update
  using (get_my_role() = 'super-admin');
create policy "Super-Admin delete" on production_plans for delete
  using (get_my_role() = 'super-admin');
`;

async function main() {
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

  console.log("Applying role capability expansion migration via Management API...");
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
