import { Product } from "@/lib/types";
import { CATEGORY_TREE } from "@/lib/categoryTree";
import { productBucket } from "@/lib/productHelpers";
import { ProgressBar } from "@/components/ui/ProgressBar";

interface CategoryChartProps {
  products: Product[];
}

export function CategoryChart({ products }: CategoryChartProps) {
  const rows = Object.keys(CATEGORY_TREE)
    .map((cat) => {
      const items = products.filter((p) => p.category === cat);
      const published = items.filter(
        (p) => productBucket(p) === "published"
      ).length;
      return { category: cat, total: items.length, published };
    })
    .sort((a, b) => b.total - a.total);

  return (
    <div>
      {rows.map((row) => (
        <div
          key={row.category}
          className={`flex items-center gap-3 border-b border-seasalt py-[9px] last:border-b-0 ${
            row.total === 0 ? "opacity-40" : ""
          }`}
        >
          <div className="w-[170px] flex-shrink-0 text-[12.5px] font-bold">
            {row.category}
          </div>
          <div className="flex-1">
            <ProgressBar
              percent={row.total === 0 ? 0 : (row.published / row.total) * 100}
              height={8}
            />
          </div>
          <div className="w-[110px] flex-shrink-0 text-right text-[11px] font-bold text-ink-soft">
            {row.total === 0
              ? "No requests yet"
              : `${row.published}/${row.total} published`}
          </div>
        </div>
      ))}
    </div>
  );
}
