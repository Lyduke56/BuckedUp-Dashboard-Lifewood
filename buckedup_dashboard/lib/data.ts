import type { PipelineStatus } from "./types";

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
  "Design",
  "Production",
  "In Review",
  "Published",
];

export const STATUS_CLASS: Record<PipelineStatus, string> = {
  "Not Started": "not-started",
  Design: "design",
  Production: "production",
  "In Review": "in-review",
  Published: "published",
};

export const STATUS_HEX: Record<PipelineStatus, string> = {
  "Not Started": "#E5E5E5",
  Design: "#FFC370",
  Production: "#8CA496",
  "In Review": "#417256",
  Published: "#046241",
};

// Light-theme variant of STATUS_HEX — KanbanBoard.tsx's inline styles
// (column header dot/border, floating tooltip) read these directly since
// they can't be expressed as CSS custom properties the way the board's
// structural chrome (backgrounds/borders/text) already is. Dark-mode's
// paler tones (e.g. "Not Started"'s near-white gray) would nearly vanish
// against a white card, so this darkens/deepens each stage's hue rather
// than reusing STATUS_HEX verbatim.
export const STATUS_HEX_LIGHT: Record<PipelineStatus, string> = {
  "Not Started": "#B8B8B8",
  Design: "#E0954A",
  Production: "#5C8A72",
  "In Review": "#2F5940",
  Published: "#046241",
};

// `products.review_status` — kept as a loose string in the data layer since
// the full value set isn't enforced by a DB check constraint, so styling
// here is best-effort with a neutral fallback.
const REVIEW_STATUS_CLASS: Record<string, string> = {
  "Not Started": "not-started",
  "In Production": "in-production",
  Accepted: "accepted",
  Rejected: "rejected",
};

export function reviewStatusClass(status: string | null): string {
  if (!status) return "not-started";
  return REVIEW_STATUS_CLASS[status] ?? "unknown";
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
  "In Production": "#FFB347",
  Accepted: "#046241",
  Rejected: "#D03B3B",
};

// Fallback only — used until an admin creates a production_plans row (see
// lib/useProductionPlan.ts). Once one exists, ProjectProgressCard and
// DailyProgressChart read the real daily_video_target/start_date/deadline
// instead of these.
export const DAILY_VIDEO_TARGET = 3;
export const PROJECT_START_DATE = "2026-07-01";
export const PROJECT_DEADLINE = "2026-09-01";

// DailyProgressChart is now backed by lib/useDailyProgress.ts (live rollup
// of product_status_history) — the old MOCK_DAILY_PROGRESS sample array was
// removed when that landed.

export interface ProjectPacing {
  status: "COMPLETE" | "ON TRACK" | "AT RISK" | "LATE";
  statusHex: string;
  daysToDeadline: number;
  expectedPct: number;
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
  startDate: string = PROJECT_START_DATE,
  deadlineDate: string = PROJECT_DEADLINE,
): ProjectPacing {
  const start = new Date(startDate).getTime();
  const deadline = new Date(deadlineDate).getTime();
  const now = today.getTime();

  const totalMs = deadline - start;
  const expectedPct =
    totalMs <= 0
      ? 100
      : Math.min(100, Math.max(0, ((now - start) / totalMs) * 100));

  const daysToDeadline = Math.round((deadline - now) / MS_PER_DAY);
  const gap = expectedPct - actualPct;

  if (actualPct >= 100) {
    return { status: "COMPLETE", statusHex: PACING_HEX.good, daysToDeadline, expectedPct };
  }
  if (now > deadline) {
    return { status: "LATE", statusHex: PACING_HEX.critical, daysToDeadline, expectedPct };
  }
  if (gap <= 5) {
    return { status: "ON TRACK", statusHex: PACING_HEX.good, daysToDeadline, expectedPct };
  }
  if (gap <= 20) {
    return { status: "AT RISK", statusHex: PACING_HEX.warning, daysToDeadline, expectedPct };
  }
  return { status: "LATE", statusHex: PACING_HEX.critical, daysToDeadline, expectedPct };
}
