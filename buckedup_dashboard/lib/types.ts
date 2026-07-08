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
 * The Sheet's "Status" column — a coarser review/approval state, separate
 * from the granular pipeline stage ("Stages" column, see PipelineStatus).
 * Kept as `string` rather than a strict union since the dropdown's full
 * value set isn't documented; known values get dedicated styling and
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
 * Issues are tracked locally by this dashboard (see lib/useIssues.ts) —
 * they are NOT written to the Google Sheet. The Sheet stays read-only per
 * the project's architecture; this is a separate, dashboard-only resource.
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
