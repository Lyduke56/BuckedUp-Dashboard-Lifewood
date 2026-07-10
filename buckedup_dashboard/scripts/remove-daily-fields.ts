import { Client } from "pg";

async function main() {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    throw new Error("SUPABASE_DB_URL is not set in .env.local");
  }

  const client = new Client({ connectionString });
  await client.connect();
  console.log("Connected to database. Altering production_plans table...");

  try {
    await client.query(`
      ALTER TABLE production_plans DROP COLUMN IF EXISTS daily_video_target;
      ALTER TABLE production_plans DROP COLUMN IF EXISTS stage_targets;
    `);
    console.log("Columns daily_video_target and stage_targets dropped successfully.");
  } catch (err) {
    console.error("Migration failed:", err);
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
