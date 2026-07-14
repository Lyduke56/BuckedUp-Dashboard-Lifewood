"use client";

import { useState } from "react";
import { REVIEW_STATUS_HEX, REVIEW_STATUS_ORDER } from "@/lib/data";
import type { Product } from "@/lib/types";
import { ChartTooltip } from "@/components/atoms/ChartTooltip";

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
  const [tooltip, setTooltip] = useState<{ isVisible: boolean; x: number; y: number; content: React.ReactNode }>({
    isVisible: false,
    x: 0,
    y: 0,
    content: null,
  });
  const [activeLegend, setActiveLegend] = useState<string | null>(null);

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
          slices.map((slice) => {
            const percent = Math.round((slice.count / total) * 100);
            return slice.end > slice.start ? (
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
                style={{
                  opacity: activeLegend && activeLegend !== slice.label ? 0.25 : 1,
                  transition: "opacity 0.2s ease, filter 0.2s ease",
                  cursor: "pointer",
                  filter: activeLegend === slice.label ? "brightness(1.1)" : "none",
                }}
                onMouseMove={(e) => {
                  setTooltip({
                    isVisible: true,
                    x: e.clientX,
                    y: e.clientY,
                    content: (
                      <>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: slice.color }} />
                          <span className="font-semibold text-[12px]">{slice.label}</span>
                        </div>
                        <div className="text-white/80">{slice.count} products ({percent}%)</div>
                      </>
                    ),
                  });
                }}
                onMouseEnter={() => setActiveLegend(slice.label)}
                onMouseLeave={() => {
                  setActiveLegend(null);
                  setTooltip((prev) => ({ ...prev, isVisible: false }));
                }}
              />
            ) : null;
          })
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
          <div 
            key={row.label} 
            className="category-legend-item cursor-default transition-all duration-200"
            style={{ 
              opacity: activeLegend && activeLegend !== row.label ? 0.3 : 1,
              transform: activeLegend === row.label ? "scale(1.02)" : "scale(1)",
            }}
            onMouseEnter={() => setActiveLegend(row.label)}
            onMouseLeave={() => setActiveLegend(null)}
          >
            <span
              className="category-legend-dot transition-transform"
              style={{ background: row.color, transform: activeLegend === row.label ? "scale(1.2)" : "scale(1)" }}
            />
            {row.label} — {row.count}
            {total > 0 ? ` (${Math.round((row.count / total) * 100)}%)` : ""}
          </div>
        ))}
      </div>
      <ChartTooltip {...tooltip} />
    </div>
  );
}
