"use client";

import { useState } from "react";
import { STATUS_HEX, STATUS_ORDER } from "@/lib/data";
import type { StageAge } from "@/lib/useStageAge";
import type { Product } from "@/lib/types";

interface StageAgeChartProps {
  products: Product[];
  stageAgeByProductId: Map<string, StageAge>;
}

// Bottleneck view: avg days products have spent in their *current* stage,
// cross-referenced with live products to guarantee correctness.
export function StageAgeChart({ products, stageAgeByProductId }: StageAgeChartProps) {
  const [tooltip, setTooltip] = useState({ x: 0, y: 0, content: "", borderColor: "", visible: false });

  // Map each product to its active stage age using live status and fallback to 0
  const entries = products.map((product) => {
    const currentStatus = product.items[0]?.status || "Not Started";
    const history = stageAgeByProductId.get(product.id);
    
    if (history && history.status === currentStatus) {
      return {
        status: currentStatus,
        days: history.days,
      };
    }
    return {
      status: currentStatus,
      days: 0,
    };
  });

  const rows = STATUS_ORDER.map((status) => {
    const inStage = entries.filter((entry) => entry.status === status);
    const avgDays =
      inStage.length === 0
        ? 0
        : inStage.reduce((sum, entry) => sum + entry.days, 0) / inStage.length;
    return { status, count: inStage.length, avgDays };
  });

  const maxDays = Math.max(...rows.map((row) => row.avgDays), 0.1);

  const showTip = (e: React.MouseEvent, content: string, borderColor: string = "") =>
    setTooltip({ x: e.clientX, y: e.clientY, content, borderColor, visible: true });
  const moveTip = (e: React.MouseEvent) =>
    setTooltip(t => ({ ...t, x: e.clientX, y: e.clientY }));
  const hideTip = () => setTooltip(t => ({ ...t, visible: false }));

  if (products.length === 0) {
    return (
      <div className="empty-state">
        No active products matching the filters.
      </div>
    );
  }

  return (
    <>
      {rows.map((row) => {
        const color = STATUS_HEX[row.status] || "var(--castleton)";
        
        if (row.count === 0) {
          return (
            <div key={row.status} className="flex flex-col mb-4 last:mb-0 opacity-30 select-none">
              <div className="flex justify-between items-center text-xs font-bold mb-1.5 text-[var(--ink-soft)]">
                <span>{row.status}</span>
                <span>No items</span>
              </div>
              <div className="h-2 w-full bg-white/[0.02] border border-white/[0.04] rounded-full overflow-hidden" />
            </div>
          );
        }

        const pct = Math.round((row.avgDays / maxDays) * 100);
        const tooltipText = `${row.status}: ${row.count} item${row.count === 1 ? "" : "s"} · avg ${row.avgDays.toFixed(1)} days in stage`;
        return (
          <div
            key={row.status}
            className="flex flex-col mb-4 last:mb-0 group"
            onMouseMove={(e) => { showTip(e, tooltipText, color); moveTip(e); }}
            onMouseLeave={hideTip}
            style={{ cursor: "default" }}
          >
            <div className="flex justify-between items-center text-xs font-bold mb-1.5">
              <span className="text-[var(--text-main)] group-hover:text-[var(--castleton)] transition-colors duration-200">
                {row.status}
              </span>
              <span className="text-[var(--ink-soft)] font-semibold">
                {row.count} item{row.count === 1 ? "" : "s"} · avg <span className="text-[var(--text-main)]">{row.avgDays.toFixed(1)}d</span>
              </span>
            </div>
            <div className="h-2 w-full bg-white/[0.03] border border-white/[0.05] rounded-full overflow-hidden relative backdrop-blur-md transition-all duration-300 group-hover:bg-white/[0.05] group-hover:border-white/[0.08]">
              <div
                className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: `${Math.max(pct, 1.5)}%`,
                  background: `linear-gradient(90deg, ${color}33 0%, ${color} 100%)`,
                  boxShadow: `0 0 8px ${color}33`,
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
            borderColor: tooltip.borderColor,
            borderWidth: tooltip.borderColor ? "1.5px" : "1px",
          }}
        >
          {tooltip.content}
        </div>
      )}
    </>
  );
}
