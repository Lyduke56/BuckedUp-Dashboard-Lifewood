"use client";

import { useState } from "react";
import type { Product } from "@/lib/types";

interface LanguageProgressChartProps {
  products: Product[];
  languageTargets?: Record<string, number>;
}

export function LanguageProgressChart({
  products,
  languageTargets,
}: LanguageProgressChartProps) {
  const [tooltip, setTooltip] = useState({ x: 0, y: 0, content: "", visible: false });

  const languages = Array.from(
    new Set(products.map((product) => product.language)),
  );

  const rows = languages
    .map((language) => {
      const items = products.filter(
        (product) => product.language === language,
      );
      const delivered = items.filter(
        (product) => product.reviewStatus === "Accepted",
      ).length;
      return { language, total: items.length, delivered };
    })
    .sort((a, b) => b.total - a.total);

  const showTip = (e: React.MouseEvent, content: string) =>
    setTooltip({ x: e.clientX, y: e.clientY, content, visible: true });
  const moveTip = (e: React.MouseEvent) =>
    setTooltip(t => ({ ...t, x: e.clientX, y: e.clientY }));
  const hideTip = () => setTooltip(t => ({ ...t, visible: false }));

  return (
    <>
      {rows.map((row) => {
        const targetVal = languageTargets?.[row.language];
        const targetPct = row.total > 0 && targetVal ? (targetVal / row.total) * 100 : 0;

        if (row.total === 0) {
          return (
            <div key={row.language} className="flex flex-col mb-4 last:mb-0 opacity-30 select-none">
              <div className="flex justify-between items-center text-xs font-bold mb-1.5 text-[var(--ink-soft)]">
                <span>{row.language}</span>
                <span>No items</span>
              </div>
              <div className="h-2 w-full bg-white/[0.02] border border-white/[0.04] rounded-full overflow-hidden" />
            </div>
          );
        }

        const pct = Math.round((row.delivered / row.total) * 100);
        const tipText = `${row.language}: ${row.delivered}/${row.total} accepted (${pct}%)${targetVal ? ` · Target: ${targetVal}` : ""}`;
        return (
          <div
            key={row.language}
            className="flex flex-col mb-4 last:mb-0 group"
            onMouseMove={(e) => { showTip(e, tipText); moveTip(e); }}
            onMouseLeave={hideTip}
            style={{ cursor: "default" }}
          >
            <div className="flex justify-between items-center text-xs font-bold mb-1.5">
              <span className="text-[var(--text-main)] group-hover:text-[var(--castleton)] transition-colors duration-200 truncate pr-2 max-w-[170px]">
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
                  title={`Target: ${targetVal}`}
                />
              )}
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
