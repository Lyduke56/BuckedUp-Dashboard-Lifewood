export type ViewId = "overview" | "library";

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

export interface VideoItem {
  name: string;
  status: PipelineStatus;
  videoUrl: string | null;
  variant?: string;
}

export interface Product {
  rank: number;
  name: string;
  category: string;
  subcategory: string;
  price: string;
  type: string;
  items: VideoItem[];
}
