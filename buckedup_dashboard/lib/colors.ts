// lib/colors.ts

// Deliberately spread across the color wheel (not just green/orange shades)
// so adjacent cards read as different categories at a glance.
export const CATEGORY_PALETTE = [
  "var(--cat-teal)",
  "var(--cat-amber)",
  "var(--cat-indigo)",
  "var(--cat-rose)",
  "var(--cat-plum)",
  "var(--cat-olive)",
  "var(--cat-rust)",
  "var(--cat-slate)",
  "var(--castleton)",
  "var(--saffron)",
] as const;

/**
 * Simple deterministic string hash (djb2), so a category's color
 * is stable no matter what order CATEGORY_TREE's keys are declared in,
 * and doesn't shift just because a new category gets added elsewhere.
 */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return Math.abs(hash);
}

export function categoryColor(category: string): string {
  const idx = hashString(category) % CATEGORY_PALETTE.length;
  return CATEGORY_PALETTE[idx];
}

/** Precompute a category -> color map, useful for legends/filters. */
export function buildCategoryColorMap(categories: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const category of categories) {
    map.set(category, categoryColor(category));
  }
  return map;
}