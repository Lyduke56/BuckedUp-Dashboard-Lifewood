import { CATEGORY_TREE } from "@/lib/data";
import type { Product } from "@/lib/types";
import { productBucket } from "@/lib/utils";

interface CategoryChartProps {
  products: Product[];
}

export function CategoryChart({ products }: CategoryChartProps) {
  const rows = Object.keys(CATEGORY_TREE)
    .map((category) => {
      const items = products.filter((product) => product.category === category);
      const published = items.filter(
        (product) => productBucket(product) === "published",
      ).length;
      return { category, total: items.length, published };
    })
    .sort((a, b) => b.total - a.total);

  return (
    <>
      {rows.map((row) => {
        if (row.total === 0) {
          return (
            <div key={row.category} className="cat2-row inactive">
              <div className="cat2-label">{row.category}</div>
              <div className="cat2-track">
                <div className="cat2-fill" style={{ width: "0%" }} />
              </div>
              <div className="cat2-count">No requests yet</div>
            </div>
          );
        }

        const pct = Math.round((row.published / row.total) * 100);
        return (
          <div key={row.category} className="cat2-row">
            <div className="cat2-label">{row.category}</div>
            <div className="cat2-track">
              <div className="cat2-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="cat2-count">
              {row.published}/{row.total} published
            </div>
          </div>
        );
      })}
    </>
  );
}
