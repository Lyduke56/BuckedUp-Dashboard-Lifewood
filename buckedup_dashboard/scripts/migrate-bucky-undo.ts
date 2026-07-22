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
CREATE TABLE IF NOT EXISTS bucky_deleted_product_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete set null,
  product_name text not null,
  product_rank integer not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  restored_at timestamptz
);

CREATE INDEX IF NOT EXISTS bucky_deleted_product_snapshots_expiry_idx
  ON bucky_deleted_product_snapshots (expires_at)
  WHERE restored_at IS NULL;

ALTER TABLE bucky_deleted_product_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin read" ON bucky_deleted_product_snapshots;
CREATE POLICY "Admin read" ON bucky_deleted_product_snapshots FOR SELECT
  USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS "Admin insert" ON bucky_deleted_product_snapshots;
CREATE POLICY "Admin insert" ON bucky_deleted_product_snapshots FOR INSERT
  WITH CHECK (get_my_role() = 'admin' AND user_id = auth.uid());

DROP POLICY IF EXISTS "Admin delete expired" ON bucky_deleted_product_snapshots;
CREATE POLICY "Admin delete expired" ON bucky_deleted_product_snapshots FOR DELETE
  USING (get_my_role() = 'admin' AND expires_at < now());

CREATE OR REPLACE FUNCTION restore_deleted_product(p_snapshot_id uuid)
RETURNS uuid AS $$
DECLARE
  v_row bucky_deleted_product_snapshots;
  v_snapshot jsonb;
  v_new_id uuid;
BEGIN
  IF get_my_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only admins can restore a deleted product';
  END IF;

  SELECT * INTO v_row FROM bucky_deleted_product_snapshots
    WHERE id = p_snapshot_id AND restored_at IS NULL AND expires_at > now();
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'No restorable snapshot found (already restored, or the undo window has expired)';
  END IF;

  v_snapshot := v_row.snapshot;

  INSERT INTO products
    SELECT * FROM jsonb_populate_record(null::products, v_snapshot->'product')
    RETURNING id INTO v_new_id;

  INSERT INTO issues
    SELECT * FROM jsonb_populate_recordset(null::issues, COALESCE(v_snapshot->'issues', '[]'::jsonb));
  INSERT INTO product_status_history
    SELECT * FROM jsonb_populate_recordset(null::product_status_history, COALESCE(v_snapshot->'product_status_history', '[]'::jsonb));
  INSERT INTO video_versions
    SELECT * FROM jsonb_populate_recordset(null::video_versions, COALESCE(v_snapshot->'video_versions', '[]'::jsonb));
  INSERT INTO stage_deliverables
    SELECT * FROM jsonb_populate_recordset(null::stage_deliverables, COALESCE(v_snapshot->'stage_deliverables', '[]'::jsonb));

  UPDATE bucky_deleted_product_snapshots SET restored_at = now() WHERE id = p_snapshot_id;

  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
`;

async function main() {
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

  console.log("Applying Bucky undo-window migration via Management API...");
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
