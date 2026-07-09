"use client";

import { useState } from "react";
import { STATUS_HEX, STATUS_ORDER } from "@/lib/data";
import type { StageAge } from "@/lib/useStageAge";

interface StageAgeChartProps {
  stageAgeByProductId: Map<string, StageAge>;
}

// Bottleneck view: avg days products have spent in their *current* stage,
// not a historical average across completed transitions — see
// lib/useStageAge.ts for why (there's no completed-transition history to
// average yet, and this is useful from day one).
export function StageAgeChart({ stageAgeByProductId }: StageAgeChartProps) {
  const [tooltip, setTooltip] = useState({ x: 0, y: 0, content: "", visible: false });

  const entries = Array.from(stageAgeByProductId.values());

  const rows = STATUS_ORDER.map((status) => {
    const inStage = entries.filter((entry) => entry.status === status);
    const avgDays =
      inStage.length === 0
        ? 0
        : inStage.reduce((sum, entry) => sum + entry.days, 0) / inStage.length;
    return { status, count: inStage.length, avgDays };
  });

  const maxDays = Math.max(...rows.map((row) => row.avgDays), 1);

  const showTip = (e: React.MouseEvent, content: string) =>
    setTooltip({ x: e.clientX, y: e.clientY, content, visible: true });
  const moveTip = (e: React.MouseEvent) =>
    setTooltip(t => ({ ...t, x: e.clientX, y: e.clientY }));
  const hideTip = () => setTooltip(t => ({ ...t, visible: false }));

  if (entries.length === 0) {
    return (
      <div className="empty-state">
        No stage history yet — this populates as products move through the
        pipeline.
      </div>
    );
  }

  return (
    <>
      {rows.map((row) => {
        if (row.count === 0) {
          return (
            <div key={row.status} className="cat2-row inactive">
              <div className="cat2-label">{row.status}</div>
              <div className="cat2-track">
                <div className="cat2-fill" style={{ width: "0%" }} />
              </div>
              <div className="cat2-count">No items</div>
            </div>
          );
        }

        const pct = Math.round((row.avgDays / maxDays) * 100);
        const tooltipText = `${row.status}: ${row.count} item${row.count === 1 ? "" : "s"} · avg ${row.avgDays.toFixed(1)} days in stage`;
        return (
          <div
            key={row.status}
            className="cat2-row"
            onMouseMove={(e) => { showTip(e, tooltipText); moveTip(e); }}
            onMouseLeave={hideTip}
            style={{ cursor: "default" }}
          >
            <div className="cat2-label">{row.status}</div>
            <div className="cat2-track">
              <div
                className="cat2-fill"
                style={{ width: `${pct}%`, background: STATUS_HEX[row.status] }}
              />
            </div>
            <div className="cat2-count">
              {row.count} item{row.count === 1 ? "" : "s"}, avg{" "}
              {row.avgDays.toFixed(1)}d
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
