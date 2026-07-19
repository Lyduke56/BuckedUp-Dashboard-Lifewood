-- BuckedUp AIGC Dashboard — Product Catalog Migration
--
-- Run this in the Supabase SQL Editor AFTER the main schema.sql has been
-- applied. It adds the canonical product catalog (master list of what
-- BuckedUp sells) and links it to the existing video-production `products`
-- table via a nullable FK. The FK is nullable so existing `products` rows
-- are unaffected until a backfill or a new "Request Video" action links them.
--
-- After running this, execute:
--   npm run db:seed-catalog   (populates catalog_products from the Google Sheet)
-- and optionally:
--   UPDATE products p
--     SET catalog_product_id = cp.id
--     FROM catalog_products cp
--     WHERE lower(trim(p.name)) = lower(trim(cp.name));
-- to backfill historical rows by name.

-- ============================================================
-- 1. Master product catalog
-- ============================================================
create table if not exists catalog_products (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  category      text not null,
  subcategory   text not null,
  -- Variants stored as a JSON array of strings, e.g.
  -- ["Razzle Dazzle", "Tropical", "Berry"]
  -- Kept as jsonb (not a child table) because variant lists are small,
  -- rarely queried relationally, and change as a unit when the catalog
  -- is updated from the source sheet.
  variants      jsonb not null default '[]'::jsonb,
  -- Generated column so callers never need to remember to keep it in sync.
  variant_count int generated always as (jsonb_array_length(variants)) stored,
  price         text,           -- display string: "$54.99" / "from $49.99"
  flag_status   text,           -- "★ Best Seller #1" / "NEW" / "CLEARANCE"
  product_url   text,
  thumbnail_url text,
  -- Soft-delete: set false instead of deleting when a product is
  -- discontinued — keeps historical FK references intact.
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- 2. Link video-production requests back to the catalog
-- ============================================================
alter table products
  add column if not exists catalog_product_id uuid
    references catalog_products(id) on delete set null;

-- ============================================================
-- 3. Row Level Security
-- ============================================================
alter table catalog_products enable row level security;

-- Everyone (incl. anon) can read the catalog — same model as products.
create policy "Public read"
  on catalog_products for select
  using (true);

-- Leads and Admins may write, consistent with the products table permission model.
create policy "Lead and admin insert"
  on catalog_products for insert
  with check (get_my_role() in ('lead', 'admin'));

create policy "Lead and admin update"
  on catalog_products for update
  using (get_my_role() in ('lead', 'admin'));

create policy "Lead and admin delete"
  on catalog_products for delete
  using (get_my_role() in ('lead', 'admin'));

-- ============================================================
-- 4. Auto-maintain updated_at (reuses the existing trigger fn)
-- ============================================================
create trigger catalog_products_set_updated_at
  before update on catalog_products
  for each row
  execute function set_updated_at();

-- ============================================================
-- 5. Realtime — live sync across dashboard sessions
-- ============================================================
alter publication supabase_realtime add table catalog_products;

-- ============================================================
-- 6. Allow system queries & service-role scripts to update products
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
