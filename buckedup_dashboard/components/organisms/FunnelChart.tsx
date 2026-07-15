"use client";

import { useState } from "react";
import { STATUS_HEX, STATUS_ORDER } from "@/lib/data";
import type { Product } from "@/lib/types";
import { ChartTooltip } from "@/components/atoms/ChartTooltip";

interface FunnelChartProps {
  products: Product[];
}

export function FunnelChart({ products }: FunnelChartProps) {
  const [tooltip, setTooltip] = useState({
    x: 0,
    y: 0,
    content: "",
    borderColor: "",
    visible: false,
  });

  const showTip = (e: React.MouseEvent, content: string, borderColor: string = "") =>
    setTooltip({ x: e.clientX, y: e.clientY, content, borderColor, visible: true });
  const moveTip = (e: React.MouseEvent) =>
    setTooltip((t) => ({ ...t, x: e.clientX, y: e.clientY }));
  const hideTip = () => setTooltip((t) => ({ ...t, visible: false }));

  const items = products.flatMap((product) => product.items);
  const total = items.length;

  // Calculate cumulative counts
  // cumulative[status] = number of items at this stage or any stage after it
  const cumulativeCounts = STATUS_ORDER.reduce((acc, status, index) => {
    const activeCount = items.filter((item) => {
      const itemIndex = STATUS_ORDER.indexOf(item.status);
      return itemIndex >= index;
    }).length;
    acc[status] = activeCount;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex flex-col gap-3 py-2">
      {STATUS_ORDER.map((status, index) => {
        const count = cumulativeCounts[status];
        const previousCount = index > 0 ? cumulativeCounts[STATUS_ORDER[index - 1]] : total;
        
        // Cumulative percentage of total
        const pctOfTotal = total > 0 ? Math.round((count / total) * 100) : 0;
        
        // Stage-to-stage conversion rate
        const conversionRate = previousCount > 0 ? Math.round((count / previousCount) * 100) : 0;

        // Custom styling variables
        const color = STATUS_HEX[status] || "var(--castleton)";
        const widthPct = total > 0 ? (count / total) * 100 : 0;

        return (
          <div
            key={status}
            className="flex items-center gap-4 group"
            onMouseMove={moveTip}
            onMouseLeave={hideTip}
            style={{ cursor: "default" }}
          >
            {/* Label Column */}
            <div className="w-24 text-right text-xs font-semibold text-[var(--ink-soft)] truncate group-hover:text-[var(--text-main)] transition-colors duration-200">
              {status}
            </div>

            {/* Funnel Segment Track */}
            <div className="flex-1 h-8 bg-white/[0.02] border border-white/[0.04] rounded-lg overflow-hidden relative backdrop-blur-md transition-all duration-300 group-hover:bg-white/[0.04] group-hover:border-white/[0.08]">
              {/* Funnel Segment Fill */}
              <div
                className="h-full transition-all duration-1000 ease-out"
                style={{
                  width: `${Math.max(widthPct, 1.5)}%`,
                  background: `linear-gradient(90deg, ${color}33 0%, ${color}aa 100%)`,
                  borderRight: `2px solid ${color}`,
                  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.1), 0 0 12px ${color}22`,
                }}
                onMouseEnter={(e) => {
                  showTip(
                    e,
                    `${status}: ${count} reached (${pctOfTotal}%)` + 
                    (index > 0 ? ` · ${conversionRate}% step conversion` : ""),
                    color
                  );
                }}
              />

              {/* Stats overlay */}
              <div className="absolute inset-y-0 right-3 flex items-center gap-2 pointer-events-none text-[11px] font-bold">
                <span className="text-[var(--text-main)]">{count}</span>
                <span className="text-[var(--ink-soft)] font-medium">({pctOfTotal}%)</span>
              </div>
            </div>

            {/* Small Conversion Pill */}
            <div className="w-16 text-xs text-left">
              {index > 0 ? (
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    conversionRate >= 80
                      ? "bg-[var(--castleton-glow)] text-[var(--castleton)]"
                      : conversionRate >= 50
                      ? "bg-[rgba(250,178,25,0.1)] text-[var(--saffron)]"
                      : "bg-[rgba(208,59,59,0.1)] text-[#D03B3B]"
                  }`}
                >
                  ↓ {conversionRate}%
                </span>
              ) : (
                <span className="text-[9px] uppercase tracking-wider text-[var(--ink-soft)] font-bold px-1.5 py-0.5">
                  100%
                </span>
              )}
            </div>
          </div>
        );
      })}

      {/* Shared Tooltip */}
      <ChartTooltip
        isVisible={tooltip.visible}
        x={tooltip.x}
        y={tooltip.y}
        content={tooltip.content}
        borderColor={tooltip.borderColor}
      />
    </div>
  );
}
