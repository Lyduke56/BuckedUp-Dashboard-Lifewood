import type { Product } from "@/lib/types";
import { productBucket } from "@/lib/utils";

interface OverviewSnapshotProps {
  products: Product[];
}

export function OverviewSnapshot({ products }: OverviewSnapshotProps) {
  // Calculate total and published counts per category
  const categoryStats: Record<string, { total: number; published: number }> = {};
  
  products.forEach((product) => {
    const cat = product.category;
    if (!categoryStats[cat]) {
      categoryStats[cat] = { total: 0, published: 0 };
    }
    categoryStats[cat].total += 1;
    if (productBucket(product) === "published") {
      categoryStats[cat].published += 1;
    }
  });

  // Sort by total requests descending to keep active/large categories at the top
  const active = Object.entries(categoryStats).sort((a, b) => b[1].total - a[1].total);

  return (
    <>
      {active.map(([category, stats]) => {
        const pct = stats.total > 0 ? Math.round((stats.published / stats.total) * 100) : 0;
        return (
          <div key={category} className="snapshot-row">
            <div className="snapshot-label">{category}</div>
            <div className="snapshot-track" title={`${pct}% complete`}>
              <div
                className="snapshot-fill"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="snapshot-count" style={{ width: 'auto', minWidth: '130px', whiteSpace: 'nowrap' }}>
              <span className="font-bold text-white">{stats.published}</span> / {stats.total} published ({pct}%)
            </div>
          </div>
        );
      })}
    </>
  );
}
