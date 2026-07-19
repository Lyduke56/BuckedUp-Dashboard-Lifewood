const XLSX = require("xlsx");
const path = require("path");

const headers = [
  "No.",
  "Date",
  "Month",
  "Daily Targets",
  "Actual",
  "Completion Rate (Images)",
  "Target (Accumulative)",
  "Actual (Accumulative)",
];

const rows = [headers];

// Cover June 1, 2026 to August 31, 2026 (92 days around today July 18, 2026)
const startDate = new Date(2026, 5, 1); // June 1, 2026
const endDate = new Date(2026, 7, 31);  // August 31, 2026

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

let accum = 0;
let no = 1;

for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const dateStr = y + "-" + m + "-" + day;
  const monthName = months[d.getMonth()];

  // Realistic target variation: 3-5 videos on weekdays, 1 on weekends
  const dow = d.getDay();
  const dailyTarget = (dow === 0 || dow === 6) ? 1 : ((no % 3) + 3);

  accum += dailyTarget;
  rows.push([no++, dateStr, monthName, dailyTarget, 0, 0, accum, 0]);
}

const ws = XLSX.utils.aoa_to_sheet(rows);

// Set nice column widths
ws["!cols"] = [
  { wch: 6 },  // No.
  { wch: 14 }, // Date
  { wch: 12 }, // Month
  { wch: 16 }, // Daily Targets
  { wch: 10 }, // Actual
  { wch: 24 }, // Completion Rate
  { wch: 22 }, // Target (Accumulative)
  { wch: 22 }, // Actual (Accumulative)
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Production Plan 2026");

// Save next to Production Plan.xlsx in the workspace root
const outPath = path.resolve(__dirname, "../../Test Production Plan July 2026.xlsx");
XLSX.writeFile(wb, outPath);

console.log("Successfully generated:", outPath);
console.log("Total days of target data:", rows.length - 1);
console.log("Start Date:", rows[1][1], "| Daily Target:", rows[1][3], "| Accum:", rows[1][6]);
console.log("Mid-July (Today July 18, 2026):", rows[48][1], "| Daily Target:", rows[48][3], "| Accum:", rows[48][6]);
console.log("End Date:", rows[rows.length - 1][1], "| Daily Target:", rows[rows.length - 1][3], "| Accum:", rows[rows.length - 1][6]);
