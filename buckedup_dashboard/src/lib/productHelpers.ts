import { Product, ProductBucket } from "./types";

export function totalVideos(products: Product[]): number {
  return products.reduce((sum, p) => sum + p.items.length, 0);
}

export function doneVideos(products: Product[]): number {
  return products.reduce(
    (sum, p) => sum + p.items.filter((it) => it.published).length,
    0
  );
}

export function productDone(product: Product): number {
  return product.items.filter((it) => it.published).length;
}

export function productBucket(product: Product): ProductBucket {
  const done = productDone(product);
  const total = product.items.length;
  if (done === 0) return "not-started";
  if (done === total) return "published";
  return "in-progress";
}

export function bucketLabel(bucket: ProductBucket): string {
  return {
    "not-started": "Not started",
    "in-progress": "In progress",
    published: "Published",
  }[bucket];
}

export function categoryCount(products: Product[], category: string): number {
  return products.filter((p) => p.category === category).length;
}

export function subcategoryCount(
  products: Product[],
  category: string,
  subcategory: string
): number {
  return products.filter(
    (p) => p.category === category && p.subcategory === subcategory
  ).length;
}

export function slugifyProductName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
