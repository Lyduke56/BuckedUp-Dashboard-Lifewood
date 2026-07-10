"use client";

import { useState } from "react";
import { CATEGORY_TREE } from "@/lib/data";
import type { Product } from "@/lib/types";

interface RejectionRateChartProps {
  products: Product[];
}

export function RejectionRateChart({ products }: RejectionRateChartProps) {
  const [tooltip, setTooltip] = useState({ x: 0, y: 0, content: "", visible: false });

  const rows = Object.keys(CATEGORY_TREE)
    .map((category) => {
      const items = products.filter((product) => product.category === category);
      const total = items.length;
      const rejected = items.filter(
        (product) => product.reviewStatus === "Rejected",
      ).length;
      const rate = total === 0 ? 0 : Math.round((rejected / total) * 100);
      return { category, total, rejected, rate };
    })
    .sort((a, b) => {
      // Sort by rate descending, then total descending
      if (b.rate !== a.rate) return b.rate - a.rate;
      return b.total - a.total;
    });

  const showTip = (e: React.MouseEvent, content: string) =>
    setTooltip({ x: e.clientX, y: e.clientY, content, visible: true });
  const moveTip = (e: React.MouseEvent) =>
    setTooltip((t) => ({ ...t, x: e.clientX, y: e.clientY }));
  const hideTip = () => setTooltip((t) => ({ ...t, visible: false }));

  return (
    <>
      {rows.map((row) => {
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

        const tooltipText = `${row.category}: ${row.rejected} of ${row.total} products rejected (${row.rate}%)`;
        
        // Color scale based on rejection rate severity
        const barColor = row.rate > 50 
          ? "linear-gradient(90deg, rgba(208, 59, 59, 0.2) 0%, rgba(208, 59, 59, 0.8) 100%)"
          : row.rate > 0
          ? "linear-gradient(90deg, rgba(250, 178, 25, 0.15) 0%, rgba(250, 178, 25, 0.7) 100%)"
          : "rgba(255, 255, 255, 0.05)";

        const rightBorder = row.rate > 50 
          ? "2px solid #D03B3B" 
          : row.rate > 0 
          ? "2px solid var(--saffron)" 
          : "none";

        return (
          <div
            key={row.category}
            className="flex flex-col mb-4 last:mb-0 group"
            onMouseEnter={(e) => showTip(e, tooltipText)}
            onMouseMove={moveTip}
            onMouseLeave={hideTip}
            style={{ cursor: "default" }}
          >
            <div className="flex justify-between items-center text-xs font-bold mb-1.5">
              <span className="text-[var(--text-main)] group-hover:text-[var(--castleton)] transition-colors duration-200 truncate pr-2 max-w-[170px]">
                {row.category}
              </span>
              <span className="text-[var(--ink-soft)] font-semibold flex-shrink-0">
                {row.rate > 0 ? (
                  <span className={row.rate > 50 ? "text-[#D03B3B] font-bold" : "text-[var(--saffron)] font-bold"}>
                    {row.rate}%
                  </span>
                ) : (
                  <span className="text-[var(--ink-soft)]">0%</span>
                )}
                <span className="text-[var(--ink-soft)] font-medium ml-1">({row.rejected}/{row.total})</span>
              </span>
            </div>
            <div className="h-2 w-full bg-white/[0.03] border border-white/[0.05] rounded-full overflow-hidden relative backdrop-blur-md transition-all duration-300 group-hover:bg-white/[0.05] group-hover:border-white/[0.08]">
              <div
                className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: `${row.rate}%`,
                  background: barColor,
                  borderRight: rightBorder,
                  boxShadow: row.rate > 0 ? "0 0 8px rgba(208, 59, 59, 0.15)" : "none",
                }}
              />
            </div>
          </div>
        );
      })}

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
