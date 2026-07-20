/**
 * Scopes the scheduled proactive pacing alert (bucky_check_proactive_alerts,
 * used by both the client-side effect and the daily pg_cron job) to leads
 * only. Operators previously received it too — but Planning and Analytics
 * (where production-plan targets and daily-pacing charts live) are both
 * deliberately hidden from operators in the dashboard UI (see TabBar.tsx),
 * and this alert was quietly contradicting that by volunteering the exact
 * daily target and shortfall unprompted. The stale-item check (part 2 of
 * this function) is untouched — that's about an operator's own claimed
 * work, not company-wide targets, so it has no reason to be hidden.
 *
 * Run: npx tsx scripts/migrate-bucky-pacing-lead-only.ts
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
create or replace function bucky_check_proactive_alerts()
returns void as $$
declare
  v_stale_days constant integer := 3;
  v_default_daily_target constant integer := 3;
  v_today constant date := current_date;
  v_lead_message text;
  v_operator_message text;
  v_recipient record;
  v_active_plan record;
  v_today_target integer;
  v_today_published integer;
begin
  -- 1. Lead stale-item check: products stuck in 'In Review' >= 3 days.
  -- Team-wide (review is a lead responsibility), one shared notification
  -- per lead.
  with lead_stale as (
    select p.rank, p.name, latest.entered_at,
      round(extract(epoch from (now() - latest.entered_at)) / 86400.0, 1) as days
    from products p
    join lateral (
      select status, entered_at
      from product_status_history h
      where h.product_id = p.id
      order by h.entered_at desc
      limit 1
    ) latest on true
    where p.status = 'In Review'
      and latest.status = 'In Review'
      and latest.entered_at <= now() - (v_stale_days || ' days')::interval
    order by latest.entered_at asc
    limit 5
  )
  select string_agg(
    format('#%s "%s" (%sd)', rank, name, days),
    E'\\n' order by entered_at asc
  )
  into v_lead_message
  from lead_stale;

  if v_lead_message is not null then
    for v_recipient in select id from profiles where role = 'lead' loop
      insert into notifications (recipient_id, type, message, product_id)
      values (
        v_recipient.id,
        'bucky_stale_item',
        E'Some items have been waiting in review for a while:\\n' || v_lead_message,
        null
      )
      on conflict (recipient_id, type, created_date)
        where type in ('bucky_stale_item', 'bucky_pacing_behind')
        do nothing;
    end loop;
  end if;

  -- 2. Operator stale-item check: each operator's own claimed products
  -- stuck (in any active stage, not just In Review) >= 3 days. Scoped
  -- per operator, run once per operator. Unchanged by this migration.
  for v_recipient in select id from profiles where role = 'operator' loop
    with operator_stale as (
      select p.rank, p.name, latest.status, latest.entered_at,
        round(extract(epoch from (now() - latest.entered_at)) / 86400.0, 1) as days
      from products p
      join lateral (
        select status, entered_at
        from product_status_history h
        where h.product_id = p.id
        order by h.entered_at desc
        limit 1
      ) latest on true
      where p.owner_id = v_recipient.id
        and p.status = latest.status
        and latest.status not in ('Not Started', 'Published')
        and latest.entered_at <= now() - (v_stale_days || ' days')::interval
      order by latest.entered_at asc
      limit 5
    )
    select string_agg(
      format('#%s "%s" (%sd in %s)', rank, name, days, status),
      E'\\n' order by entered_at asc
    )
    into v_operator_message
    from operator_stale;

    if v_operator_message is not null then
      insert into notifications (recipient_id, type, message, product_id)
      values (
        v_recipient.id,
        'bucky_stale_item',
        E'Some of your assigned videos have been stuck for a while:\\n' || v_operator_message,
        null
      )
      on conflict (recipient_id, type, created_date)
        where type in ('bucky_stale_item', 'bucky_pacing_behind')
        do nothing;
    end if;
    v_operator_message := null;
  end loop;

  -- 3. Pacing check: today's published count vs. today's target. NOW
  -- LEAD-ONLY (was lead + operator) -- pacing/targets are a Planning-tab
  -- concept, deliberately hidden from operators in the dashboard UI.
  select * into v_active_plan from production_plans where is_active = true limit 1;

  v_today_target := coalesce(
    (v_active_plan.daily_accumulative_targets ->> to_char(v_today, 'YYYY-MM-DD'))::integer,
    (select target from daily_target_history where date = v_today),
    v_default_daily_target
  );

  select count(*) into v_today_published
  from product_status_history
  where status = 'Published'
    and entered_at::date = v_today;

  if v_today_published < v_today_target then
    for v_recipient in select id from profiles where role = 'lead' loop
      insert into notifications (recipient_id, type, message, product_id)
      values (
        v_recipient.id,
        'bucky_pacing_behind',
        format('Production is behind pace today: %s of %s videos published so far.', v_today_published, v_today_target),
        null
      )
      on conflict (recipient_id, type, created_date)
        where type in ('bucky_stale_item', 'bucky_pacing_behind')
        do nothing;
    end loop;
  end if;
end;
$$ language plpgsql security definer set search_path = public;
`;

async function main() {
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

  console.log("Scoping bucky_check_proactive_alerts()'s pacing check to leads only...");
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
