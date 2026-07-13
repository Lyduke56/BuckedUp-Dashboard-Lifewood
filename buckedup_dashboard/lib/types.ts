export type ViewId = "overview" | "library" | "analytics" | "admin";

/**
 * operator = production staff, execution-only: uploads deliverables per
 * stage (video_url) and can claim ownership on upload, reports/resolves
 * issues — never creates a listing and never moves `products.status`.
 * lead = the operational owner: fusion of the old approver + old admin's
 * catalog powers — creates listings/products, configures the production
 * plan, reviews Operator-submitted deliverables, and is the only role
 * that actually moves a product's stage.
 * admin = governance only — manages Lead/Operator user accounts, no
 * product-catalog write access at all. Enforced by supabase/schema.sql's
 * RLS policies and enforce_product_update_permissions trigger — the UI
 * hides controls a role can't use, but the database is what actually
 * blocks it.
 */
export type UserRole = "operator" | "lead" | "admin";

export interface Profile {
  id: string;
  email: string;
  role: UserRole;
}

export type StatusFilter = "all" | "not-started" | "in-progress" | "published";

export type ProductBucket = "not-started" | "in-progress" | "published";

export type PipelineStatus =
  | "Not Started"
  | "Storyboarding"
  | "Scripting"
  | "Prompting"
  | "Editing"
  | "In Review"
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
  ownerId: string | null;
  publishDate: string | null;
  reviewStatus: ReviewStatus | null;
  rejectionReason: string | null;
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

/**
 * The corporate-level plan the pipeline is measured against — admin-only
 * write, public read (see supabase/schema.sql's production_plans table).
 * Only one row has isActive at a time, DB-enforced via a unique partial
 * index; the app always reads "the" plan as `is_active = true`.
 */
export interface ProductionPlan {
  id: string;
  name: string;
  isActive: boolean;
  totalVideoTarget: number;
  dailyVideoTarget: number;
  startDate: string;
  deadline: string;
  stageTargets: Record<string, number>;
  languageTargets: Record<string, number>;
  categoryTargets: Record<string, number>;
  notes: string | null;
}
