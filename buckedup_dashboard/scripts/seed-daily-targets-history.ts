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
INSERT INTO daily_target_history (date, target) VALUES
  ('2026-07-01', 3),
  ('2026-07-02', 3),
  ('2026-07-03', 4),
  ('2026-07-04', 4),
  ('2026-07-05', 2),
  ('2026-07-06', 2),
  ('2026-07-07', 5),
  ('2026-07-08', 5),
  ('2026-07-09', 6),
  ('2026-07-10', 6),
  ('2026-07-11', 4),
  ('2026-07-12', 4),
  ('2026-07-13', 5),
  ('2026-07-14', 7)
ON CONFLICT (date) DO UPDATE SET target = EXCLUDED.target;
`;

async function main() {
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

  console.log("Seeding predefined target history via Management API...");
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
    console.error("Seeding failed:", body);
    process.exit(1);
  }

  console.log("✓ Predefined targets seeded successfully:", body);
}

main();
