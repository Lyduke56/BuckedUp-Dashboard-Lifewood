import { Client } from "pg";

async function main() {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) throw new Error("Missing DB URL");
  const client = new Client({ connectionString });
  await client.connect();

  const sql = `
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
  `;

  await client.query(sql);
  console.log("Trigger function updated successfully.");
  await client.end();
}
main();
