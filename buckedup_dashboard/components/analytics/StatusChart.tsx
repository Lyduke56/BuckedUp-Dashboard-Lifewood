import { STATUS_HEX, STATUS_ORDER } from "@/lib/data";
import type { Product } from "@/lib/types";
import { stageIndex } from "@/lib/utils";

interface StatusChartProps {
  products: Product[];
}

export function StatusChart({ products }: StatusChartProps) {
  const items = products.flatMap((product) => product.items);
  const total = items.length || 1;

  // Cumulative "reached this stage or beyond" — a funnel, not a per-stage
  // snapshot. Surfaces where the bottleneck actually is (the biggest drop
  // between consecutive stages), which a flat per-stage count can't show.
  const rows = STATUS_ORDER.map((status) => {
    const threshold = stageIndex(status);
    const count = items.filter(
      (item) => stageIndex(item.status) >= threshold,
    ).length;
    return { status, count, pct: (count / total) * 100 };
  });

  return (
    <div className="funnel-chart">
      {rows.map((row, index) => {
        const prev = rows[index - 1];
        const dropped = prev ? prev.count - row.count : 0;
        return (
          <div key={row.status} className="funnel-row">
            <div className="funnel-label">{row.status}</div>
            <div className="funnel-track">
              <div
                className="funnel-bar"
                style={{
                  width: `${row.pct}%`,
                  background: STATUS_HEX[row.status],
                }}
              />
            </div>
            <div className="funnel-value">
              {row.count} ({Math.round(row.pct)}%)
            </div>
            <div className="funnel-drop">{dropped > 0 ? `-${dropped}` : ""}</div>
          </div>
        );
      })}
    </div>
  );
}
