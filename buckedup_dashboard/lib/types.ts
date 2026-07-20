export type ViewId = "overview" | "catalog" | "library" | "analytics" | "admin" | "planning" | "bucky" | "reviews";

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
  | "Design"
  | "Production"
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

/**
 * pipeline = normal content, moves through all 7 pipeline stages.
 * link = an external URL/asset submitted directly, counted as Published
 * on creation and never entering the stage pipeline (see
 * products.delivery_type in supabase/schema.sql).
 */
export type DeliveryType = "pipeline" | "link";

export interface Product {
  id: string;
  rank: number;
  priority: "High" | "Medium" | "Low";
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
  deliveryType: DeliveryType;
  thumbnailUrl: string | null;
  /** FK to catalog_products.id — null for one-off products not in the catalog */
  catalogProductId: string | null;
  items: VideoItem[];
  createdAt: string;
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
  productId?: string;
  description: string;
  severity: IssueSeverity;
  status: IssueStatus;
  createdAt: string;
}

/**
 * A per-stage QA/QC deliverable an Operator submits for one of the two
 * document/text stages (Storyboarding/Scripting) and a Lead
 * reviews. The Production video leg uses video_versions instead.
 * See supabase/schema.sql's stage_deliverables table.
 */
export type DeliverableStage = "Storyboarding" | "Scripting";
export type DeliverableKind = "file" | "text";
export type DeliverableDecision = "pending" | "accepted" | "rejected";

export interface StageDeliverable {
  id: string;
  productId: string;
  stage: DeliverableStage;
  kind: DeliverableKind;
  fileUrl: string | null;
  textContent: string | null;
  isCurrent: boolean;
  submittedBy: string | null;
  submittedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  decision: DeliverableDecision;
  decisionNote: string | null;
}

/**
 * The stages whose deliverable is a document/text row in stage_deliverables
 * (as opposed to Production, whose deliverable is a video in video_versions).
 */
export const DELIVERABLE_STAGES: DeliverableStage[] = [
  "Storyboarding",
  "Scripting",
];

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
  dailyAccumulativeTargets: Record<string, number> | null;
}

/**
 * A row from the `catalog_products` table — the master list of what
 * BuckedUp sells (supplements, apparel, gear). One catalog product may
 * have zero or many corresponding `products` rows (video production
 * requests) linked via products.catalog_product_id.
 */
export interface CatalogProduct {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  /** Array of variant strings, e.g. ["Blue Raz", "Rocket Pop"] */
  variants: string[];
  variantCount: number;
  price: string | null;
  flagStatus: string | null;
  productUrl: string | null;
  thumbnailUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AigcStatus = "none" | "in-progress" | "published";
