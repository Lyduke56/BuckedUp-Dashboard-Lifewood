"use client";

import { useState } from "react";
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
  const [tooltip, setTooltip] = useState({ x: 0, y: 0, content: "", visible: false });

  const showTip = (e: React.MouseEvent, content: string) =>
    setTooltip({ x: e.clientX, y: e.clientY, content, visible: true });
  const moveTip = (e: React.MouseEvent) =>
    setTooltip(t => ({ ...t, x: e.clientX, y: e.clientY }));
  const hideTip = () => setTooltip(t => ({ ...t, visible: false }));

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
              onMouseMove={(e) => { showTip(e, `${status}: ${count} video${count === 1 ? "" : "s"} (${pct}%)`); moveTip(e); }}
              onMouseLeave={hideTip}
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
        {stackOrder.map((status) => (
          <div
            key={status}
            className="category-legend-item"
            onMouseMove={(e) => { showTip(e, `${status}: ${counts[status]} video${counts[status] === 1 ? "" : "s"} (${Math.round((counts[status] / total) * 100)}%)`); moveTip(e); }}
            onMouseLeave={hideTip}
            style={{ cursor: "default" }}
          >
            <span
              className="category-legend-dot"
              style={{ background: STATUS_HEX[status] }}
            />
            {status} — {counts[status]} (
            {Math.round((counts[status] / total) * 100)}%)
          </div>
        ))}
      </div>

      {tooltip.visible && (
        <div
          className="chart-tooltip"
          style={{
            position: "fixed",
            left: tooltip.x + 14,
            top: tooltip.y - 8,
            zIndex: 10000,
            pointerEvents: "none",
          }}
        >
          {tooltip.content}
        </div>
      )}
    </div>
  );
}
