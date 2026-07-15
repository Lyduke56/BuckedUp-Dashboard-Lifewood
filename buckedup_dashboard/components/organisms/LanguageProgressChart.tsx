"use client";

import { useState, useMemo } from "react";
import type { Product } from "@/lib/types";
import { ChartTooltip } from "@/components/atoms/ChartTooltip";

interface LanguageProgressChartProps {
  products: Product[];
  languageTargets?: Record<string, number>;
}

export function LanguageProgressChart({ products, languageTargets }: LanguageProgressChartProps) {
  const [tooltip, setTooltip] = useState({ x: 0, y: 0, content: "", visible: false });

  const showTip = (e: React.MouseEvent, content: string) =>
    setTooltip({ x: e.clientX, y: e.clientY, content, visible: true });
  const moveTip = (e: React.MouseEvent) =>
    setTooltip(t => ({ ...t, x: e.clientX, y: e.clientY }));
  const hideTip = () => setTooltip(t => ({ ...t, visible: false }));

  const rows = useMemo(() => {
    const stats = new Map<string, { total: number; delivered: number }>();

    products.forEach((p) => {
      const lang = p.language || "Unknown";
      if (!stats.has(lang)) {
        stats.set(lang, { total: 0, delivered: 0 });
      }
      const s = stats.get(lang)!;
      s.total++;
      if (p.items.some((i) => i.status === "Published")) {
        s.delivered++;
      }
    });

    return Array.from(stats.entries())
      .map(([language, counts]) => ({
        language,
        total: counts.total,
        delivered: counts.delivered,
        pct: counts.total > 0 ? (counts.delivered / counts.total) * 100 : 0,
      }))
      .sort((a, b) => b.pct - a.pct);
  }, [products]);

  if (rows.length === 0) {
    return (
      <div className="empty-state">
        No language data available.
      </div>
    );
  }

  return (
    <>
      {rows.map((row) => {
        const pct = row.total > 0 ? Math.round((row.delivered / row.total) * 100) : 0;
        const targetVal = languageTargets?.[row.language];
        const targetPct = targetVal ? (row.delivered / targetVal) * 100 : 0;
        const tipText = `${row.language}: ${row.delivered} / ${row.total} accepted (${pct}%)${targetVal ? ` · Target: ${targetVal}` : ""}`;

        return (
          <div
            key={row.language}
            className="flex flex-col mb-4 last:mb-0 group"
            onMouseMove={(e) => { showTip(e, tipText); moveTip(e); }}
            onMouseLeave={hideTip}
            style={{ cursor: "default" }}
          >
            <div className="flex justify-between items-center text-xs font-bold mb-1.5">
              <span className="text-[var(--text-main)] group-hover:text-[var(--castleton)] transition-colors duration-200">
                {row.language}
              </span>
              <span className="text-[var(--ink-soft)] font-semibold flex-shrink-0">
                {row.delivered} / {row.total} <span className="text-[var(--text-main)]">accepted</span>
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
                />
              )}
            </div>
          </div>
        );
      })}

      <ChartTooltip
        isVisible={tooltip.visible}
        x={tooltip.x}
        y={tooltip.y}
        content={tooltip.content}
      />
    </>
  );
}
