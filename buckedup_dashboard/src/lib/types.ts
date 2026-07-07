export type ProductBucket = "not-started" | "in-progress" | "published";

export interface VideoItem {
  id: string;
  name: string;
  variant?: string;
  published: boolean;
}

export interface Product {
  rank: number;
  name: string;
  category: string;
  subcategory: string;
  price: string;
  contentType: string;
  items: VideoItem[];
}

export interface CategoryTree {
  [category: string]: string[];
}

export type StatusFilter = "all" | ProductBucket;
