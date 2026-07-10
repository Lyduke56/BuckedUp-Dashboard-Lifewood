"use client";

import { useState } from "react";
import { CATEGORY_TREE } from "@/lib/data";
import type { Product } from "@/lib/types";
import { productBucket } from "@/lib/utils";

interface CategoryChartProps {
  products: Product[];
  categoryTargets?: Record<string, number>;
}

interface TooltipState {
  x: number;
  y: number;
  content: string;
  visible: boolean;
}

export function CategoryChart({ products, categoryTargets }: CategoryChartProps) {
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
    setTooltip({ x: e.clientX, y: e.clientY, content, visible: true });
  };

  const hideTooltip = () => setTooltip(t => ({ ...t, visible: false }));

  return (
    <>
      {rows.map((row) => {
        const targetVal = categoryTargets?.[row.category];
        const targetPct = row.total > 0 && targetVal ? (targetVal / row.total) * 100 : 0;

        if (row.total === 0) {
          return (
            <div key={row.category} className="flex flex-col mb-4 last:mb-0 opacity-30 select-none">
              <div className="flex justify-between items-center text-xs font-bold mb-1.5 text-[var(--ink-soft)]">
                <span>{row.category}</span>
                <span>No requests</span>
              </div>
              <div className="h-2 w-full bg-white/[0.02] border border-white/[0.04] rounded-full overflow-hidden" />
            </div>
          );
        }

        const pct = Math.round((row.published / row.total) * 100);
        const tooltipText = `${row.category}: ${row.published}/${row.total} published (${pct}%)${targetVal ? ` · Target: ${targetVal}` : ""} · ${row.inProgress} in progress`;
        return (
          <div
            key={row.category}
            className="flex flex-col mb-4 last:mb-0 group"
            onMouseMove={(e) => showTooltip(e, tooltipText)}
            onMouseLeave={hideTooltip}
            style={{ cursor: "default" }}
          >
            <div className="flex justify-between items-center text-xs font-bold mb-1.5">
              <span className="text-[var(--text-main)] group-hover:text-[var(--castleton)] transition-colors duration-200 truncate pr-2 max-w-[170px]">
                {row.category}
              </span>
              <span className="text-[var(--ink-soft)] font-semibold flex-shrink-0">
                {row.published} / {row.total} <span className="text-[var(--text-main)]">published</span>
              </span>
            </div>
            <div className="h-2 w-full bg-white/[0.03] border border-white/[0.05] rounded-full overflow-hidden relative backdrop-blur-md transition-all duration-300 group-hover:bg-white/[0.05] group-hover:border-white/[0.08]">
              {/* Progress Fill */}
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--castleton)] to-[#059669] transition-all duration-1000 ease-out"
                style={{
                  width: `${Math.max(pct, 1.5)}%`,
                  boxShadow: "0 0 8px rgba(16, 185, 129, 0.2)",
                }}
              />
              {/* Target Marker Tick */}
              {targetVal && targetVal > 0 && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white/70 border-r border-black/40 z-10"
                  style={{ left: `${Math.min(targetPct, 100)}%` }}
                  title={`Target: ${targetVal}`}
                />
              )}
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
