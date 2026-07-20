import { readFileSync } from "fs";
import { join } from "path";

// Manually load .env.local
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
alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('issue_reported', 'rejected', 'assigned', 'bucky_stale_item', 'bucky_pacing_behind', 'stage_change'));

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

  if new.status is distinct from old.status
    and new.owner_id is not null
    and new.owner_id = old.owner_id
    and new.owner_id <> auth.uid() then
    insert into notifications (recipient_id, type, message, product_id)
    values (new.owner_id, 'stage_change', '"' || new.name || '" moved to ' || new.status, new.id);
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;
`;

async function main() {
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

  console.log("Applying stage change notifications migration via Management API...");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ query: SQL }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Error: ${res.status} ${res.statusText}`);
    console.error(err);
    process.exit(1);
  }

  console.log("Migration applied successfully!");
}

main().catch(console.error);
