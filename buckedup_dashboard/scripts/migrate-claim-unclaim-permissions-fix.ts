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
create or replace function enforce_product_update_permissions()
returns trigger as $$
declare
  my_role user_role := get_my_role();
  is_claim boolean;
  is_unclaim boolean;
begin
  -- Allow system operations, backend service-role scripts, direct DB migrations
  -- (where auth.uid() is null or role is service_role), or controlled server
  -- functions (app.allow_stage_advance).
  if auth.uid() is null
     or auth.role() = 'service_role'
     or current_setting('app.allow_stage_advance', true) = 'on' then
    return new;
  end if;

  if my_role = 'admin' then
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

    -- Default operator validation (only allowing changing the video URL)
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
end;
$$ language plpgsql;
`;

async function main() {
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

  console.log("Updating database trigger enforce_product_update_permissions...");
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
