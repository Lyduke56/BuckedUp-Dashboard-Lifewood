export type ViewId = "overview" | "library" | "analytics";

export type StatusFilter = "all" | "not-started" | "in-progress" | "published";

export type ProductBucket = "not-started" | "in-progress" | "published";

export type PipelineStatus =
  | "Not Started"
  | "Scripting"
  | "Filming"
  | "Editing"
  | "In Review"
  | "Scheduled"
  | "Published";

/**
 * `products.review_status` — a coarser review/approval state, separate from
 * the granular pipeline stage (`products.status`, see PipelineStatus). Kept
 * as `string` rather than a strict union since the full value set isn't
 * enforced by a DB check constraint; known values get dedicated styling and
 * anything else falls back to a neutral pill.
 */
export type ReviewStatus = string;

export interface VideoItem {
  name: string;
  status: PipelineStatus;
  videoUrl: string | null;
  productUrl: string | null;
  variant?: string;
}

export interface Product {
  id: string;
  rank: number;
  name: string;
  category: string;
  subcategory: string;
  type: string;
  language: string;
  productUrl: string | null;
  contentAngle: string;
  owner: string | null;
  publishDate: string | null;
  reviewStatus: ReviewStatus | null;
  items: VideoItem[];
}

/**
 * Issues live in Supabase's `issues` table (see lib/useIssues.ts), foreign
 * keyed to `products` — a dashboard-native resource, not something that
 * ever came from or synced back to the old Google Sheet.
 */
export type IssueSeverity = "low" | "medium" | "high";
export type IssueStatus = "open" | "resolved";

export interface Issue {
  id: string;
  rank: number;
  description: string;
  severity: IssueSeverity;
  status: IssueStatus;
  createdAt: string;
}

/**
 * The shape a real "daily completions vs target" chart will consume once
 * a snapshot job exists. Supabase only holds current state, not a change
 * log, so this can't be populated today — DailyProgressChart renders an
 * empty state until real points exist.
 */
export interface DailyCompletionPoint {
  date: string;
  target: number;
  actual: number;
}
