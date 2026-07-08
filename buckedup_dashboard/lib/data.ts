import type { DailyCompletionPoint, PipelineStatus, Product } from "./types";

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

// The Sheet's "Status" column (review/approval state) — kept as a loose
// string in the data layer since the dropdown's full value set isn't
// documented, so styling here is best-effort with a neutral fallback.
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
// a real setting (Sheet cell, admin UI, or env var) once one exists.
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

export const products: Product[] = [
  {
    rank: 1,
    name: "Creatine Monohydrate",
    category: "Creatine",
    subcategory: "Creatine Powder",
    type: "Educational + Product Demo",
    productUrl: null,
    language: "English",
    contentAngle: "",
    owner: null,
    publishDate: null,
    reviewStatus: null,
    items: [
      {
        name: "Creatine Monohydrate — Educational + Product Demo",
        status: "Published",
        productUrl: null,
        videoUrl: "#",
      },
    ],
  },
  {
    rank: 2,
    name: "Woke AF Pre-Workout",
    category: "Pre-Workout & Energy",
    subcategory: "High Stimulant Pre-Workout",
    type: "Hype / POV Reel",
    productUrl: null,
    language: "English",
    contentAngle: "",
    owner: null,
    publishDate: null,
    reviewStatus: null,
    items: [
      {
        name: "Woke AF Pre-Workout — Hype / POV Reel",
        status: "Scheduled",
        productUrl: null,
        videoUrl: null,
      },
    ],
  },
  {
    rank: 3,
    name: "Bucked Up Pre-Workout",
    category: "Pre-Workout & Energy",
    subcategory: "Standard Stim Pre-Workout",
    type: "Product Demo",
    productUrl: null,
    language: "English",
    contentAngle: "",
    owner: null,
    publishDate: null,
    reviewStatus: null,
    items: [
      {
        name: "Bucked Up Pre-Workout — Product Demo (11 variants)",
        status: "In Review",
        productUrl: null,
        videoUrl: null,
      },
    ],
  },
  {
    rank: 4,
    name: "Energy Drinks",
    category: "Drinks",
    subcategory: "Energy Drinks",
    type: "Collection Haul / Taste Test",
    productUrl: null,
    language: "English",
    contentAngle: "",
    owner: null,
    publishDate: null,
    reviewStatus: null,
    items: [
      {
        name: "2-Case Custom Bundle",
        variant: "Mix & match Protein Soda + Energy",
        status: "Not Started",
        productUrl: null,
        videoUrl: null,
      },
      {
        name: "Babe Energy (2 Cases / 24 Cans)",
        variant: "Cherry Blossom, Raspberry Twist",
        status: "Scripting",
        productUrl: null,
        videoUrl: null,
      },
      {
        name: "Bucked Up Energy (2 Cases / 24 Cans)",
        variant: "15 flavors incl. NEW",
        status: "Filming",
        productUrl: null,
        videoUrl: null,
      },
      {
        name: "Bucked Up Mini Energy Drink (7.5 oz)",
        variant: "4 flavors incl. NEW",
        status: "Filming",
        productUrl: null,
        videoUrl: null,
      },
      {
        name: "Refresher™ Energy Drinks (1 Case / 12 Cans)",
        variant: "5 flavors incl. NEW",
        status: "Editing",
        productUrl: null,
        videoUrl: null,
      },
    ],
  },
  {
    rank: 5,
    name: "Protein Drinks (Protein Soda)",
    category: "Drinks",
    subcategory: "Protein Drinks",
    type: "Collection Haul / Reaction",
    productUrl: null,
    language: "English",
    contentAngle: "",
    owner: null,
    publishDate: null,
    reviewStatus: null,
    items: [
      {
        name: "Protein Popcorn (1 Bag)",
        variant: "★ Best Seller #1 · NEW",
        status: "Scripting",
        productUrl: null,
        videoUrl: null,
      },
      {
        name: "Collagen Peptides",
        variant: "★ Best Seller #8",
        status: "Not Started",
        productUrl: null,
        videoUrl: null,
      },
      {
        name: "Buck Feed Original Protein",
        variant: "★ Best Seller #20",
        status: "Not Started",
        productUrl: null,
        videoUrl: null,
      },
      {
        name: "Babe Collagen",
        variant: "Chocolate, Blueberry Pomegranate",
        status: "Not Started",
        productUrl: null,
        videoUrl: null,
      },
      {
        name: "Buck Feed All-Natural Protein",
        variant: "Chocolate",
        status: "Not Started",
        productUrl: null,
        videoUrl: null,
      },
    ],
  },
  {
    rank: 6,
    name: "Mother Bucker Pre-Workout",
    category: "Pre-Workout & Energy",
    subcategory: "High Stimulant Pre-Workout",
    type: "Product Demo / Comparison",
    productUrl: null,
    language: "English",
    contentAngle: "",
    owner: null,
    publishDate: null,
    reviewStatus: null,
    items: [
      {
        name: "Mother Bucker Pre-Workout — Product Demo / Comparison",
        status: "Editing",
        productUrl: null,
        videoUrl: null,
      },
    ],
  },
  {
    rank: 7,
    name: "Six Point Creatine",
    category: "Creatine",
    subcategory: "Creatine Powder",
    type: "Educational / Comparison",
    productUrl: null,
    language: "English",
    contentAngle: "",
    owner: null,
    publishDate: null,
    reviewStatus: null,
    items: [
      {
        name: "Six Point Creatine — Educational / Comparison",
        status: "Not Started",
        productUrl: null,
        videoUrl: null,
      },
    ],
  },
  {
    rank: 8,
    name: "RUT Testosterone Booster",
    category: "Vitamins & Wellness",
    subcategory: "Joint & Bone",
    type: "Educational",
    productUrl: null,
    language: "English",
    contentAngle: "",
    owner: null,
    publishDate: null,
    reviewStatus: null,
    items: [
      {
        name: "RUT Testosterone Booster — Educational",
        status: "Not Started",
        productUrl: null,
        videoUrl: null,
      },
    ],
  },
  {
    rank: 9,
    name: "Buck Naked Fat Burner",
    category: "Vitamins & Wellness",
    subcategory: "Joint & Bone",
    type: "Educational / Lifestyle",
    productUrl: null,
    language: "English",
    contentAngle: "",
    owner: null,
    publishDate: null,
    reviewStatus: null,
    items: [
      {
        name: "Buck Naked Fat Burner — Educational / Lifestyle",
        status: "Not Started",
        productUrl: null,
        videoUrl: null,
      },
    ],
  },
  {
    rank: 10,
    name: "Buck Feed Protein Powder",
    category: "Drinks",
    subcategory: "Protein Drinks",
    type: "Product Demo / Recipe",
    productUrl: null,
    language: "English",
    contentAngle: "",
    owner: null,
    publishDate: null,
    reviewStatus: null,
    items: [
      {
        name: "Buck Feed Protein Powder — Product Demo / Recipe",
        status: "Not Started",
        productUrl: null,
        videoUrl: null,
      },
    ],
  },
  {
    rank: 11,
    name: "PWR BUCK Energy Pouches",
    category: "Pre-Workout & Energy",
    subcategory: "On The Go Energy",
    type: "Trend Short",
    productUrl: null,
    language: "English",
    contentAngle: "",
    owner: null,
    publishDate: null,
    reviewStatus: null,
    items: [
      {
        name: "PWR BUCK Energy Pouches — Trend Short",
        status: "Not Started",
        productUrl: null,
        videoUrl: null,
      },
    ],
  },
  {
    rank: 12,
    name: "Pump Ocalypse",
    category: "Pre-Workout & Energy",
    subcategory: "Stim Free & Pump",
    type: "Product Demo / Stack",
    productUrl: null,
    language: "English",
    contentAngle: "",
    owner: null,
    publishDate: null,
    reviewStatus: null,
    items: [
      {
        name: "Pump Ocalypse — Product Demo / Stack",
        status: "Not Started",
        productUrl: null,
        videoUrl: null,
      },
    ],
  },
];
