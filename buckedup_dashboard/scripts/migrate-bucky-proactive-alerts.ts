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
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Widen the existing type check constraint to admit Bucky's two own
-- alert types alongside the pre-existing event-driven ones.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('issue_reported', 'rejected', 'assigned', 'bucky_stale_item', 'bucky_pacing_behind'));

-- Once-per-recipient-per-type-per-day dedup for Bucky's own alert types
-- only -- deliberately NOT applied to the pre-existing event-driven types,
-- which can legitimately fire more than once a day for the same recipient.
-- A real stored column (not an expression index on created_at::date) --
-- Postgres requires index expressions to be IMMUTABLE, and a timestamptz
-- -> date cast is timezone-dependent (STABLE at best), so it can't be
-- used directly in an index. DEFAULT current_date, evaluated once per
-- row at insert time, sidesteps that restriction entirely.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS created_date date NOT NULL DEFAULT current_date;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_bucky_dedup_idx
  ON notifications (recipient_id, type, created_date)
  WHERE type IN ('bucky_stale_item', 'bucky_pacing_behind');

-- Replicates BuckyWidget.tsx's Phase 5 proactive-alert logic server-side,
-- so it fires once a day regardless of whether anyone has the dashboard
-- open. Security definer: notifications has no client insert policy at
-- all (only security-definer trigger functions write to it), matching
-- notify_issue_reported()/notify_product_changes()'s existing convention.
CREATE OR REPLACE FUNCTION bucky_check_proactive_alerts()
RETURNS void AS $$
DECLARE
  v_stale_days CONSTANT integer := 3;
  v_default_daily_target CONSTANT integer := 3;
  v_today CONSTANT date := current_date;
  v_lead_message text;
  v_operator_message text;
  v_recipient record;
  v_active_plan record;
  v_today_target integer;
  v_today_published integer;
BEGIN
  -- 1. Admin stale-item check: products stuck in 'In Review' >= 3 days.
  -- Team-wide (review is a admin responsibility), one shared notification
  -- per admin.
  WITH lead_stale AS (
    SELECT p.rank, p.name, latest.entered_at,
      round(extract(epoch FROM (now() - latest.entered_at)) / 86400.0, 1) AS days
    FROM products p
    JOIN LATERAL (
      SELECT status, entered_at
      FROM product_status_history h
      WHERE h.product_id = p.id
      ORDER BY h.entered_at DESC
      LIMIT 1
    ) latest ON true
    WHERE p.status = 'In Review'
      AND latest.status = 'In Review'
      AND latest.entered_at <= now() - (v_stale_days || ' days')::interval
    ORDER BY latest.entered_at ASC
    LIMIT 5
  )
  SELECT string_agg(
    format('#%s "%s" (%sd)', rank, name, days),
    E'\\n' ORDER BY entered_at ASC
  )
  INTO v_lead_message
  FROM lead_stale;

  IF v_lead_message IS NOT NULL THEN
    FOR v_recipient IN SELECT id FROM profiles WHERE role = 'admin' LOOP
      INSERT INTO notifications (recipient_id, type, message, product_id)
      VALUES (
        v_recipient.id,
        'bucky_stale_item',
        E'Some items have been waiting in review for a while:\\n' || v_lead_message,
        null
      )
      ON CONFLICT (recipient_id, type, created_date)
        WHERE type IN ('bucky_stale_item', 'bucky_pacing_behind')
        DO NOTHING;
    END LOOP;
  END IF;

  -- 2. Operator stale-item check: each operator's own claimed products
  -- stuck (in any active stage, not just In Review) >= 3 days. Scoped
  -- per operator, run once per operator.
  FOR v_recipient IN SELECT id FROM profiles WHERE role = 'operator' LOOP
    WITH operator_stale AS (
      SELECT p.rank, p.name, latest.status, latest.entered_at,
        round(extract(epoch FROM (now() - latest.entered_at)) / 86400.0, 1) AS days
      FROM products p
      JOIN LATERAL (
        SELECT status, entered_at
        FROM product_status_history h
        WHERE h.product_id = p.id
        ORDER BY h.entered_at DESC
        LIMIT 1
      ) latest ON true
      WHERE p.owner_id = v_recipient.id
        AND p.status = latest.status
        AND latest.status NOT IN ('Not Started', 'Published')
        AND latest.entered_at <= now() - (v_stale_days || ' days')::interval
      ORDER BY latest.entered_at ASC
      LIMIT 5
    )
    SELECT string_agg(
      format('#%s "%s" (%sd in %s)', rank, name, days, status),
      E'\\n' ORDER BY entered_at ASC
    )
    INTO v_operator_message
    FROM operator_stale;

    IF v_operator_message IS NOT NULL THEN
      INSERT INTO notifications (recipient_id, type, message, product_id)
      VALUES (
        v_recipient.id,
        'bucky_stale_item',
        E'Some of your assigned videos have been stuck for a while:\\n' || v_operator_message,
        null
      )
      ON CONFLICT (recipient_id, type, created_date)
        WHERE type IN ('bucky_stale_item', 'bucky_pacing_behind')
        DO NOTHING;
    END IF;
    v_operator_message := null;
  END LOOP;

  -- 3. Pacing check: today's published count vs. today's target, same
  -- precedence as useDailyProgress.ts (plan's daily_accumulative_targets
  -- for today -> daily_target_history for today -> DAILY_VIDEO_TARGET
  -- fallback). Team-wide fact, notifies every admin and operator.
  SELECT * INTO v_active_plan FROM production_plans WHERE is_active = true LIMIT 1;

  v_today_target := coalesce(
    (v_active_plan.daily_accumulative_targets ->> to_char(v_today, 'YYYY-MM-DD'))::integer,
    (SELECT target FROM daily_target_history WHERE date = v_today),
    v_default_daily_target
  );

  SELECT count(*) INTO v_today_published
  FROM product_status_history
  WHERE status = 'Published'
    AND entered_at::date = v_today;

  IF v_today_published < v_today_target THEN
    FOR v_recipient IN SELECT id FROM profiles WHERE role IN ('admin', 'operator') LOOP
      INSERT INTO notifications (recipient_id, type, message, product_id)
      VALUES (
        v_recipient.id,
        'bucky_pacing_behind',
        format('Production is behind pace today: %s of %s videos published so far.', v_today_published, v_today_target),
        null
      )
      ON CONFLICT (recipient_id, type, created_date)
        WHERE type IN ('bucky_stale_item', 'bucky_pacing_behind')
        DO NOTHING;
    END LOOP;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Daily at 9am UTC (pg_cron's default), easy to retune later. Re-runnable:
-- drop any existing job of the same name first rather than assuming
-- cron.schedule() itself upserts by name.
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bucky-proactive-alerts') THEN
    PERFORM cron.unschedule('bucky-proactive-alerts');
  END IF;
END
$do$;

SELECT cron.schedule(
  'bucky-proactive-alerts',
  '0 9 * * *',
  $cron$SELECT bucky_check_proactive_alerts();$cron$
);
`;

async function main() {
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

  console.log("Applying Bucky proactive-alerts migration via Management API...");
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
