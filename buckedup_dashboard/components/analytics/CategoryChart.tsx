"use client";

import { useState } from "react";
import { CATEGORY_TREE } from "@/lib/data";
import type { Product } from "@/lib/types";
import { productBucket } from "@/lib/utils";

interface CategoryChartProps {
  products: Product[];
}

interface TooltipState {
  x: number;
  y: number;
  content: string;
  visible: boolean;
}

export function CategoryChart({ products }: CategoryChartProps) {
  const [tooltip, setTooltip] = useState<TooltipState>({ x: 0, y: 0, content: "", visible: false });

  const rows = Object.keys(CATEGORY_TREE)
    .map((category) => {
      const items = products.filter((product) => product.category === category);
      const published = items.filter(
        (product) => productBucket(product) === "published",
      ).length;
      const inProgress = items.filter(
        (product) => productBucket(product) === "in-progress",
      ).length;
      return { category, total: items.length, published, inProgress };
    })
    .sort((a, b) => b.total - a.total);

  const showTooltip = (e: React.MouseEvent, content: string) => {
    const rect = (e.currentTarget as HTMLElement).closest(".snapshot-track")?.getBoundingClientRect() 
      ?? (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({ x: e.clientX, y: e.clientY, content, visible: true });
  };

  const hideTooltip = () => setTooltip(t => ({ ...t, visible: false }));

  return (
    <>
      {rows.map((row) => {
        if (row.total === 0) {
          return (
            <div key={row.category} className="snapshot-row inactive" style={{ opacity: 0.5 }}>
              <div className="snapshot-label">{row.category}</div>
              <div className="snapshot-track">
                <div className="snapshot-fill" style={{ width: "0%" }} />
              </div>
              <div className="snapshot-count">No requests yet</div>
            </div>
          );
        }

        const pct = Math.round((row.published / row.total) * 100);
        const tooltipText = `${row.category}: ${row.published}/${row.total} published (${pct}%) · ${row.inProgress} in progress`;
        return (
          <div
            key={row.category}
            className="snapshot-row"
            onMouseMove={(e) => showTooltip(e, tooltipText)}
            onMouseLeave={hideTooltip}
            style={{ cursor: "default" }}
          >
            <div className="snapshot-label">{row.category}</div>
            <div className="snapshot-track">
              <div className="snapshot-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="snapshot-count">
              {row.published}/{row.total} published
            </div>
          </div>
        );
      })}

      {/* Floating tooltip */}
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
    </>
  );
}
