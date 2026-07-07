import { Product } from "@/lib/types";
import { productBucket } from "@/lib/productHelpers";
import { ProgressBar } from "@/components/ui/ProgressBar";

interface StatusChartProps {
  products: Product[];
}

const ORDER: { key: "not-started" | "in-progress" | "published"; label: string; fill: string }[] = [
  { key: "not-started", label: "Not started", fill: "bg-neutral-3" },
  { key: "in-progress", label: "In progress", fill: "bg-earth-yellow" },
  { key: "published", label: "Published", fill: "bg-castleton" },
];

export function StatusChart({ products }: StatusChartProps) {
  const counts = { "not-started": 0, "in-progress": 0, published: 0 } as Record<
    string,
    number
  >;
  products.forEach((p) => {
    counts[productBucket(p)]++;
  });
  const max = Math.max(...Object.values(counts), 1);

  return (
    <div>
      {ORDER.map(({ key, label, fill }) => (
        <div key={key} className="flex items-center gap-3 py-2">
          <div className="w-[110px] flex-shrink-0 text-xs font-bold">
            {label}
          </div>
          <div className="flex-1">
            <ProgressBar
              percent={(counts[key] / max) * 100}
              height={14}
              fillClassName={fill}
            />
          </div>
          <div className="w-6 flex-shrink-0 text-right text-xs font-extrabold text-ink-soft">
            {counts[key]}
          </div>
        </div>
      ))}
    </div>
  );
}
