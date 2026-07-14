"use client";

import { useState } from "react";
import type { Product } from "@/lib/types";
import { ChartTooltip } from "@/components/atoms/ChartTooltip";

interface OwnerWorkloadChartProps {
  products: Product[];
}

interface OwnerWorkload {
  ownerName: string;
  notStarted: number;
  inProgress: number;
  published: number;
  total: number;
}

export function OwnerWorkloadChart({ products }: OwnerWorkloadChartProps) {
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

  // Aggregate workloads by owner
  const workloadMap = new Map<string, { notStarted: number; inProgress: number; published: number }>();

  products.forEach((product) => {
    const ownerName = product.owner?.trim() || "Unassigned";
    const status = product.items[0]?.status || "Not Started";

    if (!workloadMap.has(ownerName)) {
      workloadMap.set(ownerName, { notStarted: 0, inProgress: 0, published: 0 });
    }

    const stats = workloadMap.get(ownerName)!;
    if (status === "Not Started") {
      stats.notStarted++;
    } else if (status === "Published") {
      stats.published++;
    } else {
      stats.inProgress++;
    }
  });

  const workloads: OwnerWorkload[] = Array.from(workloadMap.entries()).map(([ownerName, stats]) => {
    const total = stats.notStarted + stats.inProgress + stats.published;
    return {
      ownerName,
      ...stats,
      total,
    };
  }).sort((a, b) => {
    // Sort by active workload (not started + in progress) descending
    const aActive = a.notStarted + a.inProgress;
    const bActive = b.notStarted + b.inProgress;
    if (bActive !== aActive) return bActive - aActive;
    return b.total - a.total;
  });

  const maxTotal = Math.max(...workloads.map((w) => w.total), 1);

  if (workloads.length === 0) {
    return (
      <div className="empty-state">
        No owners assigned to any items in the queue yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 py-2">
      {workloads.map((row) => {
        const notStartedPct = (row.notStarted / maxTotal) * 100;
        const inProgressPct = (row.inProgress / maxTotal) * 100;
        const publishedPct = (row.published / maxTotal) * 100;

        const activeCount = row.notStarted + row.inProgress;

        const tooltipContent = `${row.ownerName} · Total: ${row.total} (${row.published} published · ${row.inProgress} in progress · ${row.notStarted} not started)`;

        return (
          <div
            key={row.ownerName}
            className="flex flex-col gap-1.5 group"
            onMouseMove={moveTip}
            onMouseLeave={hideTip}
            style={{ cursor: "default" }}
          >
            {/* Header info */}
            <div className="flex justify-between items-center text-xs font-semibold">
              <span className="text-[var(--text-main)] group-hover:text-[var(--castleton)] transition-colors duration-200">
                {row.ownerName}
              </span>
              <span className="text-[var(--ink-soft)]">
                {activeCount > 0 ? (
                  <span className="text-[var(--saffron)] font-bold mr-1.5">
                    {activeCount} active
                  </span>
                ) : null}
                {row.published} / {row.total} published
              </span>
            </div>

            {/* Stacked bar container */}
            <div
              className="w-full h-6 bg-white/[0.02] border border-white/[0.04] rounded-lg overflow-hidden flex relative backdrop-blur-md transition-all duration-300 group-hover:bg-white/[0.04] group-hover:border-white/[0.08]"
              onMouseEnter={(e) => showTip(e, tooltipContent, activeCount > 0 ? "var(--saffron)" : "var(--castleton)")}
            >
              {/* Published segment */}
              {row.published > 0 && (
                <div
                  className="h-full transition-all duration-1000 ease-out"
                  style={{
                    width: `${publishedPct}%`,
                    background: "linear-gradient(180deg, var(--castleton) 0%, rgba(4, 98, 65, 0.4) 100%)",
                    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 0 8px rgba(4, 98, 65, 0.1)",
                  }}
                />
              )}

              {/* In Progress segment */}
              {row.inProgress > 0 && (
                <div
                  className="h-full transition-all duration-1000 ease-out border-l border-white/[0.1]"
                  style={{
                    width: `${inProgressPct}%`,
                    background: "linear-gradient(180deg, var(--saffron) 0%, rgba(250, 178, 25, 0.4) 100%)",
                    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 0 8px rgba(250, 178, 25, 0.1)",
                  }}
                />
              )}

              {/* Not Started segment */}
              {row.notStarted > 0 && (
                <div
                  className="h-full transition-all duration-1000 ease-out border-l border-white/[0.1]"
                  style={{
                    width: `${notStartedPct}%`,
                    background: "linear-gradient(180deg, #999999 0%, rgba(153, 153, 153, 0.3) 100%)",
                  }}
                />
              )}

              {/* Text label overlay inside bar if wide enough */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-[10px] font-bold text-white/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                {row.total} total items
              </div>
            </div>
          </div>
        );
      })}

      {/* Legend inside container */}
      <div className="flex gap-4 justify-center mt-2 text-[10px] font-semibold text-[var(--ink-soft)]">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "var(--castleton)" }} />
          Published ({workloads.reduce((sum, w) => sum + w.published, 0)})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "var(--saffron)" }} />
          In Progress ({workloads.reduce((sum, w) => sum + w.inProgress, 0)})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#999999" }} />
          Not Started ({workloads.reduce((sum, w) => sum + w.notStarted, 0)})
        </span>
      </div>

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
