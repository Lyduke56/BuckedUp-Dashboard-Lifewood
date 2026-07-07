import { Product } from "@/lib/types";
import { ProgressBar } from "@/components/ui/ProgressBar";

interface CategorySnapshotProps {
  products: Product[];
}

export function CategorySnapshot({ products }: CategorySnapshotProps) {
  const counts = new Map<string, number>();
  products.forEach((p) => counts.set(p.category, (counts.get(p.category) || 0) + 1));
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const max = Math.max(...rows.map(([, count]) => count), 1);

  return (
    <div className="rounded-card border border-line bg-white p-5">
      <div className="mb-1 text-base font-extrabold text-serpent">
        Requests by category
      </div>
      <p className="mb-[18px] text-[12.5px] font-semibold text-ink-soft">
        Only categories with active requests are shown here — see Analytics
        for the full breakdown across all 10.
      </p>
      {rows.map(([category, count]) => (
        <div
          key={category}
          className="flex items-center gap-3 border-b border-seasalt py-[9px] last:border-b-0"
        >
          <div className="w-[170px] flex-shrink-0 text-[13px] font-bold">
            {category}
          </div>
          <div className="flex-1">
            <ProgressBar percent={(count / max) * 100} height={9} />
          </div>
          <div className="w-20 flex-shrink-0 text-right text-[11.5px] font-bold text-ink-soft">
            {count} requested
          </div>
        </div>
      ))}
    </div>
  );
}
