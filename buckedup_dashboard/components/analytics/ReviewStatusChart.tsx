import { REVIEW_STATUS_HEX, REVIEW_STATUS_ORDER } from "@/lib/data";
import type { Product } from "@/lib/types";

interface ReviewStatusChartProps {
  products: Product[];
}

export function ReviewStatusChart({ products }: ReviewStatusChartProps) {
  const counts: Record<string, number> = {};
  REVIEW_STATUS_ORDER.forEach((status) => {
    counts[status] = 0;
  });

  let other = 0;
  products.forEach((product) => {
    const status = product.reviewStatus ?? "Not Started";
    if (status in counts) {
      counts[status]++;
    } else {
      other++;
    }
  });

  const rows: { label: string; count: number; color: string }[] = [
    ...REVIEW_STATUS_ORDER.map((status) => ({
      label: status,
      count: counts[status],
      color: REVIEW_STATUS_HEX[status],
    })),
  ];
  if (other > 0) {
    rows.push({ label: "Other", count: other, color: "#c3c2b7" });
  }

  const max = Math.max(...rows.map((row) => row.count), 1);

  return (
    <>
      {rows.map((row) => (
        <div key={row.label} className="bar-row">
          <div className="bar-label">{row.label}</div>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{
                width: `${(row.count / max) * 100}%`,
                background: row.color,
              }}
            />
          </div>
          <div className="bar-count">{row.count}</div>
        </div>
      ))}
    </>
  );
}
