import type { DailyCompletionPoint, PipelineStatus } from "./types";

export const CATEGORY_TREE: Record<string, string[]> = {
  "Pre-Workout & Energy": [
    "Fat Burn & Thermogenic",
    "High Stimulant Pre-Workout",
    "On The Go Energy",
    "Standard Stim Pre-Workout",
    "Stim Free & Pump",
  ],
  Drinks: ["Energy Drinks", "Hydration Drinks", "Protein Drinks"],
  Creatine: ["Creatine Gummies", "Creatine Powder"],
  "Vitamins & Wellness": [
    "Antioxidants & Specialty",
    "Greens",
    "Joint & Bone",
    "Multivitamins",
    "Omegas & Healthy Fats",
  ],
  "BCAA & Amino Acids": ["BCAA", "EAAs"],
  "Deer Antler Spray": ["Deer Antler Spray"],
  Stacks: ["Stacks"],
  "Babe by Bucked Up": ["Babe By Bucked Up"],
  "Clearance & Last Chance": ["Clearance & Last Chance"],
  "Apparel & Gear": [
    "Apparel & Gear Clearance",
    "Apparel New Arrivals",
    "Bags & Bookbags",
    "Bucked Up Accessories",
    "Fitness Gear",
    "Hats & Headwear",
    "Mens Pants",
    "Mens Shorts",
    "Mens Sweater & Jackets",
    "Mens Tops",
    "Shaker Bottles & Cups",
    "Womens Leggings & Pants",
    "Womens Shorts",
    "Womens Sport Bras",
    "Womens Sweater & Jackets",
    "Womens Tops",
  ],
};

export const STATUS_ORDER: PipelineStatus[] = [
  "Not Started",
  "Scripting",
  "Filming",
  "Editing",
  "In Review",
  "Scheduled",
  "Published",
];

export const STATUS_CLASS: Record<PipelineStatus, string> = {
  "Not Started": "st-not-started",
  Scripting: "st-scripting",
  Filming: "st-filming",
  Editing: "st-editing",
  "In Review": "st-in-review",
  Scheduled: "st-scheduled",
  Published: "st-published",
};

export const STATUS_HEX: Record<PipelineStatus, string> = {
  "Not Started": "#CCCCCC",
  Scripting: "#9CAFA4",
  Filming: "#708E7C",
  Editing: "#417256",
  "In Review": "#034E34",
  Scheduled: "#133020",
  Published: "#046241",
};

// `products.review_status` — kept as a loose string in the data layer since
// the full value set isn't enforced by a DB check constraint, so styling
// here is best-effort with a neutral fallback.
const REVIEW_STATUS_CLASS: Record<string, string> = {
  "Not Started": "rs-not-started",
  "In Production": "rs-in-production",
  Accepted: "rs-accepted",
  Rejected: "rs-rejected",
};

export function reviewStatusClass(status: string | null): string {
  if (!status) return "rs-not-started";
  return REVIEW_STATUS_CLASS[status] ?? "rs-unknown";
}

export const REVIEW_STATUS_ORDER = [
  "Not Started",
  "In Production",
  "Accepted",
  "Rejected",
] as const;

// Validated via the dataviz skill's validate_palette.js: the 3 active
// states pass lightness band, chroma floor, CVD separation (deutan ΔE
// 12.4), and contrast as a set. "Not Started" is a plain neutral gray,
// exempt from that check since it's the baseline, not a competing hue.
// This is the single source of truth for review-status color — both the
// table pills (app/globals.css .rs-*) and ReviewStatusChart read from it.
export const REVIEW_STATUS_HEX: Record<string, string> = {
  "Not Started": "#999999",
  "In Production": "#2A78D6",
  Accepted: "#0CA30C",
  Rejected: "#D03B3B",
};

// Placeholder config for the Daily Target vs Actual analytics chart —
// there's no settings UI yet, so this is a plain constant. Should become
// a real setting (admin UI or a settings table row) once one exists.
export const DAILY_VIDEO_TARGET = 3;

// Illustrative-only sample data for the Daily Target chart — there's no
// real snapshot history yet (see DailyProgressChart's empty-state path,
// used until this is replaced). Never treat these numbers as real.
export const MOCK_DAILY_PROGRESS: DailyCompletionPoint[] = [
  { date: "Jul 2", target: DAILY_VIDEO_TARGET, actual: 1 },
  { date: "Jul 3", target: DAILY_VIDEO_TARGET, actual: 2 },
  { date: "Jul 4", target: DAILY_VIDEO_TARGET, actual: 0 },
  { date: "Jul 5", target: DAILY_VIDEO_TARGET, actual: 3 },
  { date: "Jul 6", target: DAILY_VIDEO_TARGET, actual: 2 },
  { date: "Jul 7", target: DAILY_VIDEO_TARGET, actual: 4 },
  { date: "Jul 8", target: DAILY_VIDEO_TARGET, actual: 1 },
];

// Placeholder project timeline — no real target ship date exists yet.
// Swap these for the real start/deadline once the team sets one; nothing
// else needs to change, computeProjectPacing() reads only these two.
export const PROJECT_START_DATE = "2026-07-01";
export const PROJECT_DEADLINE = "2026-09-01";

export interface ProjectPacing {
  status: "COMPLETE" | "ON TRACK" | "AT RISK" | "LATE";
  statusHex: string;
  daysToDeadline: number;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// Reserved status colors from the dataviz skill (good/warning/critical) —
// the same fixed roles used elsewhere, not a new categorical set.
const PACING_HEX = {
  good: "#0CA30C",
  warning: "#FAB219",
  critical: "#D03B3B",
};

export function computeProjectPacing(
  actualPct: number,
  today: Date = new Date(),
): ProjectPacing {
  const start = new Date(PROJECT_START_DATE).getTime();
  const deadline = new Date(PROJECT_DEADLINE).getTime();
  const now = today.getTime();

  const totalMs = deadline - start;
  const expectedPct =
    totalMs <= 0
      ? 100
      : Math.min(100, Math.max(0, ((now - start) / totalMs) * 100));

  const daysToDeadline = Math.round((deadline - now) / MS_PER_DAY);
  const gap = expectedPct - actualPct;

  if (actualPct >= 100) {
    return { status: "COMPLETE", statusHex: PACING_HEX.good, daysToDeadline };
  }
  if (now > deadline) {
    return { status: "LATE", statusHex: PACING_HEX.critical, daysToDeadline };
  }
  if (gap <= 5) {
    return { status: "ON TRACK", statusHex: PACING_HEX.good, daysToDeadline };
  }
  if (gap <= 20) {
    return { status: "AT RISK", statusHex: PACING_HEX.warning, daysToDeadline };
  }
  return { status: "LATE", statusHex: PACING_HEX.critical, daysToDeadline };
}
