import { STATUS_HEX, STATUS_ORDER } from "@/lib/data";
import type { Product } from "@/lib/types";

interface StatusChartProps {
  products: Product[];
}

const COLUMN_HEIGHT = 220;
const MIN_LABEL_HEIGHT = 22;
// STATUS_HEX's lightest two steps read poorly with white text.
const LIGHT_STAGES = new Set(["Not Started", "Scripting"]);

export function StatusChart({ products }: StatusChartProps) {
  const items = products.flatMap((product) => product.items);
  const total = items.length || 1;

  const counts: Record<string, number> = {};
  STATUS_ORDER.forEach((status) => {
    counts[status] = 0;
  });
  items.forEach((item) => {
    counts[item.status]++;
  });

  // Stack top-to-bottom as Published → Not Started, so the column reads
  // like a fill level (further along = higher up the stack).
  const stackOrder = [...STATUS_ORDER].reverse();

  return (
    <div className="stack-chart">
      <div className="stack-column" style={{ height: `${COLUMN_HEIGHT}px` }}>
        {stackOrder.map((status) => {
          const count = counts[status];
          if (count === 0) return null;
          const segmentHeight = (count / total) * COLUMN_HEIGHT;
          const pct = Math.round((count / total) * 100);
          return (
            <div
              key={status}
              className="stack-segment"
              style={{ height: `${segmentHeight}px`, background: STATUS_HEX[status] }}
              title={`${status}: ${count} (${pct}%)`}
            >
              {segmentHeight >= MIN_LABEL_HEIGHT ? (
                <span
                  className="stack-segment-label"
                  style={{
                    color: LIGHT_STAGES.has(status)
                      ? "var(--serpent)"
                      : "var(--white)",
                  }}
                >
                  {count}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="category-legend stack-legend">
        {STATUS_ORDER.map((status) => (
          <div key={status} className="category-legend-item">
            <span
              className="category-legend-dot"
              style={{ background: STATUS_HEX[status] }}
            />
            {status} — {counts[status]} (
            {Math.round((counts[status] / total) * 100)}%)
          </div>
        ))}
      </div>
    </div>
  );
}
