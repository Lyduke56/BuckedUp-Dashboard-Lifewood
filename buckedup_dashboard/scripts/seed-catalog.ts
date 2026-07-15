/**
 * seed-catalog.ts — One-time import of the BuckedUp product catalog from
 * the Google Sheet into the `catalog_products` Supabase table.
 *
 * Run:  npm run db:seed-catalog
 *
 * CSV column layout (gid=711882172):
 *   col[0] = empty
 *   col[1] = Photo cell (blank) / also where category+subcategory headers live
 *   col[2] = Product name  (empty on header rows)
 *   col[3] = Variants (semicolon-separated)
 *   col[4] = # Var (numeric string)
 *   col[5] = Price
 *   col[6] = Flag / Status
 *   col[7] = Product Page URL
 *
 * Header row detection:
 *   col[1] has content (with leading spaces) AND col[2] is empty
 *   → leading spaces ≤3 means top-level CATEGORY, ≥4 means subcategory
 *
 * Product row detection:
 *   col[1] is empty, col[2] has the product name
 */

// env is loaded via tsx --env-file=.env (see package.json db:seed-catalog script)
import { createClient } from "@supabase/supabase-js";

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1vfetJ32i4FhGVx_2egonCd8qZJVD0uXYzdmtWVFRNoM/export?format=csv&gid=711882172";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// ─── CSV parser ──────────────────────────────────────────────────────────────
// Handles quoted fields with embedded commas and double-quote escaping.

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      // Do NOT trim — leading spaces on col[1] are structural markers
      // distinguishing top-level categories (2 spaces) from subcategories (5 spaces).
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ─── Variant parsing ─────────────────────────────────────────────────────────

function parseVariants(raw: string): string[] {
  if (!raw || raw === "—" || raw === "-") return [];
  return raw
    .split(";")
    .map((v) => v.trim())
    .filter(Boolean);
}

// ─── Row type detection ──────────────────────────────────────────────────────
// A header row: col[1] has content, col[2] is empty.
// A product row: col[1] is empty, col[2] has the product name.

function isHeaderRow(cols: string[]): boolean {
  return (cols[1] ?? "").trim() !== "" && (cols[2] ?? "").trim() === "";
}

// Leading spaces ≤3  → top-level category (e.g. "  PRE-WORKOUT & ENERGY")
// Leading spaces ≥4  → subcategory        (e.g. "     Fat Burn & Thermogenic")
function isCategoryHeader(headerCell: string): boolean {
  const leadingSpaces = headerCell.length - headerCell.trimStart().length;
  return leadingSpaces <= 3;
}

// ─── Category name canonicalization ─────────────────────────────────────────
// Maps all-caps sheet names → exact CATEGORY_TREE keys from lib/data.ts

const CATEGORY_MAP: Record<string, string> = {
  "PRE-WORKOUT & ENERGY":   "Pre-Workout & Energy",
  "DRINKS":                 "Drinks",
  "CREATINE":               "Creatine",
  "VITAMINS & WELLNESS":    "Vitamins & Wellness",
  "BCAA & AMINO ACIDS":     "BCAA & Amino Acids",
  "DEER ANTLER SPRAY":      "Deer Antler Spray",
  "STACKS":                 "Stacks",
  "BABE BY BUCKED UP":      "Babe by Bucked Up",
  "CLEARANCE & LAST CHANCE":"Clearance & Last Chance",
  "APPAREL & GEAR":         "Apparel & Gear",
};

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Fetching catalog CSV from Google Sheets…");
  const response = await fetch(SHEET_CSV_URL);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch sheet: ${response.status} ${response.statusText}`
    );
  }
  const csv = await response.text();
  const lines = csv.split(/\r?\n/).filter(Boolean);

  console.log(`Parsing ${lines.length} raw rows…`);

  let currentCategory = "";
  let currentSubcategory = "";
  const toInsert: Array<{
    name: string;
    category: string;
    subcategory: string;
    variants: string[];
    price: string | null;
    flag_status: string | null;
    product_url: string | null;
  }> = [];

  // Row 0 is the column-label header — skip it.
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);

    if (isHeaderRow(cols)) {
      const headerCell = cols[1] ?? "";
      const trimmed = headerCell.trim();
      if (!trimmed) continue;

      if (isCategoryHeader(headerCell)) {
        // Top-level categories are ALL-CAPS in the sheet
        const canonical = CATEGORY_MAP[trimmed.toUpperCase()];
        currentCategory = canonical ?? trimmed;
        currentSubcategory = ""; // reset on new category
      } else {
        // Subcategory header
        currentSubcategory = trimmed;
      }
      continue;
    }

    // Product data row — product name is in col[2]
    const name = (cols[2] ?? "").trim();
    if (!name) continue;
    // Skip rows with no category/subcategory context (shouldn't happen in a
    // well-formed sheet, but be defensive)
    if (!currentCategory || !currentSubcategory) continue;

    const productUrl = (cols[7] ?? "").trim() || null;
    const variantsRaw = cols[3] ?? "";
    const variants = parseVariants(variantsRaw);
    const price = (cols[5] ?? "").trim() || null;
    const flagStatus = (cols[6] ?? "").trim() || null;

    toInsert.push({
      name,
      category: currentCategory,
      subcategory: currentSubcategory,
      variants,
      price,
      flag_status: flagStatus,
      product_url: productUrl,
    });
  }

  console.log(`Found ${toInsert.length} products to seed.`);
  if (toInsert.length === 0) {
    console.error("No products extracted — check CSV format.");
    process.exit(1);
  }

  // Deduplicate against rows already in the DB
  const { data: existing } = await supabase
    .from("catalog_products")
    .select("name, category, subcategory");

  const existingKeys = new Set(
    (existing ?? []).map(
      (r: { name: string; category: string; subcategory: string }) =>
        `${r.name.toLowerCase()}|${r.category.toLowerCase()}|${r.subcategory.toLowerCase()}`
    )
  );

  const newRows = toInsert.filter(
    (p) =>
      !existingKeys.has(
        `${p.name.toLowerCase()}|${p.category.toLowerCase()}|${p.subcategory.toLowerCase()}`
      )
  );

  if (newRows.length === 0) {
    console.log("All products already exist in catalog_products. Nothing to insert.");
    return;
  }

  console.log(`Inserting ${newRows.length} new rows…`);

  // Chunk inserts to avoid payload size limits
  const CHUNK = 50;
  let inserted = 0;
  for (let i = 0; i < newRows.length; i += CHUNK) {
    const chunk = newRows.slice(i, i + CHUNK);
    const { error } = await supabase.from("catalog_products").insert(chunk);
    if (error) {
      console.error(`Error inserting chunk at offset ${i}:`, error.message);
      process.exit(1);
    }
    inserted += chunk.length;
    console.log(`  ✓ ${inserted}/${newRows.length} inserted`);
  }

  console.log("\n✅ Catalog seed complete!");
  console.log("\nTo backfill existing products rows by name, run in Supabase SQL Editor:");
  console.log(`
  UPDATE products p
  SET catalog_product_id = cp.id
  FROM catalog_products cp
  WHERE lower(trim(p.name)) = lower(trim(cp.name))
    AND p.catalog_product_id IS NULL;
  `);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
