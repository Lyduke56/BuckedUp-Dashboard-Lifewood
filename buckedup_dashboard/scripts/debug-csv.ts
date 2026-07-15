// debug-csv.ts — inspect the raw CSV structure without inserting anything
// Run: npx tsx --env-file=.env scripts/debug-csv.ts

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1vfetJ32i4FhGVx_2egonCd8qZJVD0uXYzdmtWVFRNoM/export?format=csv&gid=711882172";

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current); // NOT trimming — preserve raw leading spaces
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

async function main() {
  const response = await fetch(SHEET_CSV_URL);
  const csv = await response.text();
  const lines = csv.split(/\r?\n/).filter(Boolean);

  console.log(`Total lines: ${lines.length}\n`);

  for (let i = 0; i < Math.min(30, lines.length); i++) {
    const cols = parseCSVLine(lines[i]);
    console.log(`--- Row ${i} ---`);
    cols.forEach((col, idx) => {
      if (col) {
        const spaces = col.length - col.trimStart().length;
        console.log(`  col[${idx}]: ${JSON.stringify(col)} (leading spaces: ${spaces})`);
      }
    });
  }
}

main().catch(console.error);
