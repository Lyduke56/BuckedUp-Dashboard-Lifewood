import { readFileSync } from "fs";
import { join } from "path";

try {
  const envPath = join(process.cwd(), ".env.local");
  const raw = readFileSync(envPath, "utf-8");
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match) process.env[match[1]] = match[2].trim();
  }
} catch {}

const PROJECT_REF = "iixxlgfxrctifelpixgz";
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  console.error("SUPABASE_ACCESS_TOKEN not set");
  process.exit(1);
}

const SQL = `
-- Fix review_stage_deliverable: restore correct one-to-one stage mapping
-- and add security definer + allow_stage_advance flag so the trigger
-- never blocks the advancement. The previous live version required BOTH
-- Storyboarding AND Scripting to be approved, which silently prevented
-- any stage advancement. Now accepting any stage's deliverable immediately
-- advances the product to the next stage.
create or replace function review_stage_deliverable(
  p_deliverable_id uuid,
  p_decision text,
  p_note text
)
returns void as $$
declare
  v_product_id uuid;
  v_stage text;
  v_next text;
begin
  if p_decision not in ('accepted', 'rejected') then
    raise exception 'decision must be accepted or rejected';
  end if;

  select product_id, stage into v_product_id, v_stage
  from stage_deliverables where id = p_deliverable_id;
  if v_product_id is null then
    raise exception 'deliverable not found';
  end if;

  update stage_deliverables
  set decision = p_decision,
      decision_note = p_note,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_deliverable_id;

  if p_decision = 'accepted' then
    v_next := case v_stage
      when 'Storyboarding' then 'Scripting'
      when 'Scripting'     then 'Prompting'
      when 'Prompting'     then 'Editing'
      else null
    end;
    if v_next is not null then
      perform set_config('app.allow_stage_advance', 'on', true);
      update products set status = v_next where id = v_product_id;
    end if;
  end if;
end;
$$ language plpgsql security definer set search_path = public;
`;

async function main() {
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;
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
    console.error("Fix failed:", body);
    process.exit(1);
  }
  console.log("✓ review_stage_deliverable fixed:", body);
}

main();
