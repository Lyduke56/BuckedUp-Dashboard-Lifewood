/**
 * One-time migration: Google Sheet (Video Content Plan) + local
 * data/issues.json -> Supabase (products + issues tables).
 *
 * Run once, AFTER supabase/schema.sql has been applied to a real project
 * and .env.local has real values for NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY, and NEXT_PUBLIC_VIDEO_CONTENT_PLAN_URL:
 *
 *   npm run migrate:supabase
 *
 * Uses the service_role key, which bypasses Row Level Security — this is
 * a deliberate one-time seed, not something that runs as part of the app.
 */

import { promises as fs } from "fs";
import path from "path";
import Papa from "papaparse";
import { createAdminClient } from "../lib/supabase/admin";

const KNOWN_STATUSES = [
  "Not Started",
  "Scripting",
  "Filming",
  "Editing",
  "In Review",
  "Scheduled",
  "Published",
];

interface SheetRow {
  Rank?: number | string;
  Product?: string;
  Category?: string;
  Subcategory?: string;
  "Product URL"?: string;
  "Content Angle"?: string;
  Langauge?: string;
  "Content Type"?: string;
  Owner?: string;
  Stages?: string;
  Status?: string;
  "Video URL"?: string;
  "Publish Date"?: string;
}

interface ProductRow {
  rank: number;
  name: string;
  category: string;
  subcategory: string;
  content_type: string | null;
  language: string;
  product_url: string | null;
  content_angle: string | null;
  owner: string | null;
  publish_date: string | null;
  review_status: string | null;
  status: string;
  video_url: string | null;
}

interface LocalIssue {
  rank: number;
  description: string;
  severity: string;
  status: string;
  createdAt: string;
}

function readField(row: SheetRow, ...keys: string[]): string | null {
  const record = row as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return null;
}

// Mirrors lib/useVideoRequests.ts's toProduct() mapping, targeting the
// Supabase row shape instead of the app's Product type.
function toProductRow(row: SheetRow): ProductRow | null {
  const name = row.Product?.toString().trim();
  const rank = Number(row.Rank);
  if (!name || !Number.isFinite(rank)) return null;

  const stageValue = readField(row, "Stages", "Status");
  const status =
    stageValue && KNOWN_STATUSES.includes(stageValue)
      ? stageValue
      : "Not Started";

  return {
    rank,
    name,
    category: row.Category?.toString().trim() || "Uncategorized",
    subcategory: row.Subcategory?.toString().trim() || "Uncategorized",
    content_type: row["Content Type"]?.toString().trim() || null,
    language: readField(row, "Langauge", "Language") ?? "English",
    product_url: readField(row, "Product URL"),
    content_angle: readField(row, "Content Angle"),
    owner: readField(row, "Owner"),
    publish_date: readField(row, "Publish Date"),
    review_status: readField(row, "Status"),
    status,
    video_url: readField(row, "Video URL"),
  };
}

async function main() {
  const sheetUrl = process.env.NEXT_PUBLIC_VIDEO_CONTENT_PLAN_URL;
  if (!sheetUrl) {
    throw new Error(
      "NEXT_PUBLIC_VIDEO_CONTENT_PLAN_URL is not set in .env.local",
    );
  }

  console.log("Fetching Sheet CSV...");
  const res = await fetch(sheetUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch Sheet CSV: HTTP ${res.status}`);
  }
  const csvText = await res.text();
  const parsed = Papa.parse<SheetRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  });

  const productRows = parsed.data
    .map(toProductRow)
    .filter((row): row is ProductRow => row !== null);

  console.log(`Parsed ${productRows.length} product rows from the Sheet.`);

  const supabase = createAdminClient();

  console.log("Inserting products...");
  const { data: insertedProducts, error: productsError } = await supabase
    .from("products")
    .insert(productRows)
    .select("id, rank");

  if (productsError) {
    throw new Error(`Failed to insert products: ${productsError.message}`);
  }
  console.log(`Inserted ${insertedProducts?.length ?? 0} products.`);

  const rankToId = new Map<number, string>();
  insertedProducts?.forEach((product) => rankToId.set(product.rank, product.id));

  const issuesFile = path.join(process.cwd(), "data", "issues.json");
  let localIssues: LocalIssue[] = [];
  try {
    const raw = await fs.readFile(issuesFile, "utf-8");
    localIssues = JSON.parse(raw);
  } catch {
    console.log("No local data/issues.json found — skipping issue migration.");
  }

  if (localIssues.length > 0) {
    const issueRows = localIssues
      .map((issue) => {
        const productId = rankToId.get(issue.rank);
        if (!productId) {
          console.warn(
            `Skipping issue for rank ${issue.rank} — no matching product was inserted.`,
          );
          return null;
        }
        return {
          product_id: productId,
          description: issue.description,
          severity: issue.severity,
          status: issue.status,
          created_at: issue.createdAt,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (issueRows.length > 0) {
      console.log(`Inserting ${issueRows.length} issues...`);
      const { error: issuesError } = await supabase
        .from("issues")
        .insert(issueRows);
      if (issuesError) {
        throw new Error(`Failed to insert issues: ${issuesError.message}`);
      }
    }
  }

  console.log("Migration complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
