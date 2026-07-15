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
-- 1. Create the daily_target_history table
CREATE TABLE IF NOT EXISTS daily_target_history (
  date DATE PRIMARY KEY,
  target INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Enable Row Level Security
ALTER TABLE daily_target_history ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies
DROP POLICY IF EXISTS "Public read daily target history" ON daily_target_history;
CREATE POLICY "Public read daily target history" ON daily_target_history
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Lead upsert daily target history" ON daily_target_history;
CREATE POLICY "Lead upsert daily target history" ON daily_target_history
  FOR ALL USING (get_my_role() = 'lead');

-- 4. Create helper function to sum category targets inside jsonb
CREATE OR REPLACE FUNCTION sum_jsonb_values(val jsonb)
RETURNS integer AS $$
DECLARE
  r record;
  total integer := 0;
BEGIN
  IF val IS NULL THEN
    RETURN 0;
  END IF;
  FOR r IN SELECT value FROM jsonb_each_text(val) LOOP
    total := total + coalesce(nullif(r.value, '')::integer, 0);
  END LOOP;
  RETURN total;
EXCEPTION
  WHEN OTHERS THEN
    RETURN 0;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 5. Create trigger function to automatically upsert daily target
CREATE OR REPLACE FUNCTION log_daily_target_history()
RETURNS trigger AS $$
DECLARE
  v_target integer;
  v_today date := current_date;
BEGIN
  IF new.is_active THEN
    v_target := sum_jsonb_values(new.category_targets);
    INSERT INTO daily_target_history (date, target)
    VALUES (v_today, v_target)
    ON CONFLICT (date) DO UPDATE
    SET target = EXCLUDED.target;
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql;

-- 6. Attach trigger to production_plans table
DROP TRIGGER IF EXISTS production_plans_log_daily_target ON production_plans;
CREATE TRIGGER production_plans_log_daily_target
  AFTER INSERT OR UPDATE OF category_targets, is_active ON production_plans
  FOR EACH ROW
  EXECUTE FUNCTION log_daily_target_history();

-- 7. Initialize target for today's date from the current active plan
INSERT INTO daily_target_history (date, target)
SELECT current_date, sum_jsonb_values(category_targets)
FROM production_plans
WHERE is_active = true
ON CONFLICT (date) DO NOTHING;

-- 8. Add daily_target_history to Supabase Realtime publication if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'daily_target_history'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE daily_target_history;
  END IF;
END $$;
`;

async function main() {
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

  console.log("Running daily target history migration via Management API...");
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
