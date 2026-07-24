import { Client } from "pg";

async function main() {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.log("SUPABASE_DB_URL is not set in .env.local — skipping direct Postgres migration.");
    return;
  }

  const client = new Client({ connectionString });
  await client.connect();
  console.log("Connected to Supabase Postgres. Applying tab permissions migration...");

  try {
    const migrationSql = `
      -- 1. Add tab_permissions and is_read_only columns to profiles table if they don't exist
      alter table public.profiles add column if not exists tab_permissions text[];
      alter table public.profiles add column if not exists is_read_only boolean not null default false;

      -- 2. Update enforce_profile_role_change trigger function to allow super-admins to promote others to super-admin
      create or replace function public.enforce_profile_role_change()
      returns trigger as $$
      begin
        if new.role is distinct from old.role and public.get_my_role() <> 'super-admin' then
          raise exception 'Only super-admins can change roles';
        end if;
        return new;
      end;
      $$ language plpgsql;
    `;

    await client.query(migrationSql);
    console.log("Migration executed successfully: tab_permissions & is_read_only added, super-admin promotion enabled.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Migration error:", err);
});
