/**
 * Phase F migration: products.thumbnail_url + a thumbnails storage bucket
 * (image/png|jpeg|webp, 5MB). Admin-only write (thumbnails are set at
 * listing-creation/edit time, a Admin-exclusive action). See
 * C:\Users\John Peter\.claude\plans\jaunty-conjuring-cook.md, Phase F.
 *
 * Requires SUPABASE_ACCESS_TOKEN and NEXT_PUBLIC_SUPABASE_URL in .env.local.
 * Run: npx tsx scripts/migrate-phase-f-thumbnails.ts
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
alter table products add column if not exists thumbnail_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'thumbnails',
  'thumbnails',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "Public read thumbnails" on storage.objects;
create policy "Public read thumbnails" on storage.objects for select
  using (bucket_id = 'thumbnails');
drop policy if exists "Admin upload thumbnails" on storage.objects;
create policy "Admin upload thumbnails" on storage.objects for insert
  with check (bucket_id = 'thumbnails' and get_my_role() = 'admin');
drop policy if exists "Admin update thumbnails" on storage.objects;
create policy "Admin update thumbnails" on storage.objects for update
  using (bucket_id = 'thumbnails' and get_my_role() = 'admin');
drop policy if exists "Admin delete thumbnails" on storage.objects;
create policy "Admin delete thumbnails" on storage.objects for delete
  using (bucket_id = 'thumbnails' and get_my_role() = 'admin');
`;

async function main() {
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;
  console.log("Running Phase F migration via Management API...");
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
