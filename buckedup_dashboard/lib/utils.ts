import { STATUS_ORDER } from "./data";
import type { PipelineStatus, Product, ProductBucket } from "./types";

export function stageIndex(status: PipelineStatus): number {
  return STATUS_ORDER.indexOf(status);
}

export function itemBucket(status: PipelineStatus): ProductBucket {
  if (status === "Not Started") return "not-started";
  if (status === "Published") return "published";
  return "in-progress";
}

export function totalVideos(productList: Product[]): number {
  return productList.reduce((sum, product) => sum + product.items.length, 0);
}

export function productDone(product: Product): number {
  return product.items.filter((item) => item.status === "Published").length;
}

export function productBucket(product: Product): ProductBucket {
  const buckets = product.items.map((item) => itemBucket(item.status));
  if (buckets.every((bucket) => bucket === "published")) return "published";
  if (buckets.every((bucket) => bucket === "not-started")) return "not-started";
  return "in-progress";
}

export function productProgressPct(product: Product): number {
  const fractions = product.items.map(
    (item) => stageIndex(item.status) / (STATUS_ORDER.length - 1),
  );
  return (fractions.reduce((a, b) => a + b, 0) / fractions.length) * 100;
}

export function averageProgressPct(products: Product[]): number {
  if (products.length === 0) return 0;
  const total = products.reduce(
    (sum, product) => sum + productProgressPct(product),
    0,
  );
  return total / products.length;
}

export function categoryCountProducts(
  productList: Product[],
  category: string,
): number {
  return productList.filter((product) => product.category === category).length;
}

export function subcategoryCountProducts(
  productList: Product[],
  category: string,
  subcategory: string,
): number {
  return productList.filter(
    (product) =>
      product.category === category && product.subcategory === subcategory,
  ).length;
}

export function getModalKey(rank: number, index: number): string {
  return `${rank}-${index}`;
}

export function parseModalKey(key: string): { rank: number; index: number } {
  const [rank, index] = key.split("-");
  return { rank: Number(rank), index: Number(index) };
}

const DRIVE_ID_PATTERNS = [/\/file\/d\/([a-zA-Z0-9_-]+)/, /[?&]id=([a-zA-Z0-9_-]+)/];

export function parseDriveFileId(url: string): string | null {
  for (const pattern of DRIVE_ID_PATTERNS) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}
