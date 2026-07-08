import { REVIEW_STATUS_HEX, REVIEW_STATUS_ORDER } from "@/lib/data";
import type { Product } from "@/lib/types";

interface ReviewStatusChartProps {
  products: Product[];
}

const SIZE = 180;
const CENTER = SIZE / 2;
const OUTER_R = 80;
const INNER_R = 50;
const GAP_DEG = 2;
const OTHER_COLOR = "#c3c2b7";

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startAngle: number,
  endAngle: number,
) {
  const startOuter = polarToCartesian(cx, cy, rOuter, endAngle);
  const endOuter = polarToCartesian(cx, cy, rOuter, startAngle);
  const startInner = polarToCartesian(cx, cy, rInner, endAngle);
  const endInner = polarToCartesian(cx, cy, rInner, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 0 ${endOuter.x} ${endOuter.y}`,
    `L ${endInner.x} ${endInner.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 1 ${startInner.x} ${startInner.y}`,
    "Z",
  ].join(" ");
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

  const rows = REVIEW_STATUS_ORDER.map((status) => ({
    label: status as string,
    count: counts[status],
    color: REVIEW_STATUS_HEX[status],
  }));
  if (other > 0) {
    rows.push({ label: "Other", count: other, color: OTHER_COLOR });
  }

  const total = rows.reduce((sum, row) => sum + row.count, 0);

  let cursor = 0;
  const slices = rows.map((row) => {
    const sweep = total === 0 ? 0 : (row.count / total) * 360;
    const start = cursor + GAP_DEG / 2;
    const end = cursor + sweep - GAP_DEG / 2;
    cursor += sweep;
    return { ...row, start: Math.min(start, end), end: Math.max(start, end) };
  });

  return (
    <div className="donut-chart-wrap">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width={SIZE}
        height={SIZE}
        className="donut-svg"
      >
        {total === 0 ? (
          <circle cx={CENTER} cy={CENTER} r={OUTER_R} fill="var(--seasalt)" />
        ) : (
          slices.map((slice) =>
            slice.end > slice.start ? (
              <path
                key={slice.label}
                d={arcPath(
                  CENTER,
                  CENTER,
                  OUTER_R,
                  INNER_R,
                  slice.start,
                  slice.end,
                )}
                fill={slice.color}
              >
                <title>
                  {slice.label}: {slice.count} (
                  {Math.round((slice.count / total) * 100)}%)
                </title>
              </path>
            ) : null,
          )
        )}
        <text
          x={CENTER}
          y={CENTER - 4}
          textAnchor="middle"
          className="donut-center-number"
        >
          {total}
        </text>
        <text
          x={CENTER}
          y={CENTER + 14}
          textAnchor="middle"
          className="donut-center-label"
        >
          total
        </text>
      </svg>
      <div className="category-legend donut-legend">
        {rows.map((row) => (
          <div key={row.label} className="category-legend-item">
            <span
              className="category-legend-dot"
              style={{ background: row.color }}
            />
            {row.label} — {row.count}
            {total > 0 ? ` (${Math.round((row.count / total) * 100)}%)` : ""}
          </div>
        ))}
      </div>
    </div>
  );
}
