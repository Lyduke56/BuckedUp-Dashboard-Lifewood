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
        const pct =
          row.total === 0 ? 0 : Math.round((row.delivered / row.total) * 100);
        const tipText = `${row.language}: ${row.delivered}/${row.total} accepted (${pct}%)`;
        return (
          <div
            key={row.language}
            className="snapshot-row"
            onMouseMove={(e) => { showTip(e, tipText); moveTip(e); }}
            onMouseLeave={hideTip}
            style={{ cursor: "default" }}
          >
            <div className="snapshot-label">{row.language}</div>
            <div className="snapshot-track">
              <div className="snapshot-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="snapshot-count">
              {row.delivered}/{row.total} accepted
              {languageTargets?.[row.language] ? (
                <span className="legend-target"> / target {languageTargets[row.language]}</span>
              ) : null}
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
