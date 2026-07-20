"use client";

import { useState } from "react";
import { DAILY_VIDEO_TARGET, STATUS_HEX, STATUS_ORDER } from "@/lib/data";
import { categoryColor } from "@/lib/colors";
import type { DailyProgressPoint } from "@/lib/useDailyProgress";
import { ChartTooltip } from "@/components/atoms/ChartTooltip";

interface DailyProgressChartProps {
  points: DailyProgressPoint[];
  dailyTarget?: number;
}

type Dimension = "overall" | "stage" | "category";

// Auto-thin x-axis labels like Power BI: show every Nth label so they
// never overflow the container. The step is derived from the number of
// data points and the practical minimum gap between readable labels.
function labelStep(count: number): number {
  if (count <= 14) return 1;   // 1–14 days: every day
  if (count <= 30) return 2;   // up to 30 days: every other day
  if (count <= 60) return 3;   // up to 60 days: every 3rd
  if (count <= 90) return 7;   // up to 90 days: weekly
  return 14;                   // 90+ days: bi-weekly
}

// Inline horizontal legend used by both stacked modes (By stage / By
// category). Replaces the old tall vertical list.
function HorizontalLegend({
  keys,
  colorFor,
  activeLegend,
  onEnter,
  onLeave,
}: {
  keys: string[];
  colorFor: (k: string) => string;
  activeLegend: string | null;
  onEnter: (k: string) => void;
  onLeave: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "6px 14px",
        marginTop: "8px",
        justifyContent: "center",
      }}
    >
      {keys.map((key) => (
        <div
          key={key}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            fontSize: "11px",
            fontWeight: 600,
            color: "var(--ink-soft)",
            cursor: "default",
            opacity: activeLegend && activeLegend !== key ? 0.3 : 1,
            transition: "opacity 0.2s ease",
          }}
          onMouseEnter={() => onEnter(key)}
          onMouseLeave={onLeave}
        >
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: colorFor(key),
              flexShrink: 0,
            }}
          />
          {key}
        </div>
      ))}
    </div>
  );
}

export function DailyProgressChart({
  points,
  dailyTarget = DAILY_VIDEO_TARGET,
}: DailyProgressChartProps) {
  const [dimension, setDimension] = useState<Dimension>("overall");
  const [activeLegend, setActiveLegend] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{
    isVisible: boolean;
    x: number;
    y: number;
    content: React.ReactNode;
  }>({ isVisible: false, x: 0, y: 0, content: null });

  const step = labelStep(points.length);

  const hasData = points.some(
    (p) => p.published > 0 || Object.keys(p.byStage).length > 0,
  );

  const toggle = (
    <div className="filter-pills" style={{ marginBottom: "12px" }}>
      {(["overall", "stage", "category"] as Dimension[]).map((dim) => (
        <button
          key={dim}
          type="button"
          className={`pill${dimension === dim ? " active" : ""}`}
          onClick={() => setDimension(dim)}
        >
          {dim === "overall" ? "Overall" : dim === "stage" ? "By stage" : "By category"}
        </button>
      ))}
    </div>
  );

  if (!hasData) {
    return (
      <div>
        {toggle}
        <div className="empty-state">
          No pipeline activity in the selected range yet — this populates live
          as products move through their stages. Configured daily target:{" "}
          {dailyTarget} videos/day.
        </div>
      </div>
    );
  }

  if (dimension === "overall") {
    const max = Math.max(
      ...points.map((p) => Math.max(p.target ?? dailyTarget, p.published)),
      1,
    );
    const axisMax = Math.ceil(max / 3) * 3 || 3;
    const ticks = [3, 2, 1, 0].map((s) => Math.round((axisMax / 3) * s));

    return (
      <div>
        {toggle}
        <div className="column-chart">
          <div className="column-chart-body">
            <div className="column-chart-axis">
              {ticks.map((tick, i) => (
                <div key={`${tick}-${i}`} className="column-chart-tick">
                  {tick}
                </div>
              ))}
            </div>
            <div className="column-chart-plot">
              {points.map((point, idx) => {
                const currentTarget = point.target ?? dailyTarget;
                const showLabel = idx % step === 0 || idx === points.length - 1;
                return (
                  <div key={point.date} className="column-group">
                    <div className="column-bars">
                      {/* Target bar */}
                      <div
                        className="column-bar column-bar-target cursor-pointer transition-opacity"
                        style={{
                          height: `${(currentTarget / axisMax) * 100}%`,
                          opacity: activeLegend && activeLegend !== "target" ? 0.3 : 1,
                        }}
                        onMouseEnter={() => setActiveLegend("target")}
                        onMouseMove={(e) => {
                          setTooltip({
                            isVisible: true,
                            x: e.clientX,
                            y: e.clientY,
                            content: (
                              <>
                                <div className="font-medium text-[11px] text-white/60 mb-1">{point.label}</div>
                                <div className="text-white/80 text-[12px]">
                                  Target: <span className="font-semibold">{currentTarget}</span>
                                </div>
                                <div className="text-white/80 text-[12px]">
                                  Published: <span className="font-semibold">{point.published}</span>
                                </div>
                              </>
                            ),
                          });
                        }}
                        onMouseLeave={() => {
                          setActiveLegend(null);
                          setTooltip((prev) => ({ ...prev, isVisible: false }));
                        }}
                      >
                        {points.length <= 24 && <span className="column-bar-value">{currentTarget}</span>}
                      </div>
                      {/* Actual bar */}
                      <div
                        className="column-bar column-bar-actual cursor-pointer transition-opacity"
                        style={{
                          height: `${(point.published / axisMax) * 100}%`,
                          opacity: activeLegend && activeLegend !== "published" ? 0.3 : 1,
                        }}
                        onMouseMove={(e) => {
                          setTooltip({
                            isVisible: true,
                            x: e.clientX,
                            y: e.clientY,
                            content: (
                              <>
                                <div className="font-medium text-[11px] text-white/60 mb-1">{point.label}</div>
                                <div className="text-white/80 text-[12px]">
                                  Published: <span className="font-semibold">{point.published}</span>
                                </div>
                                <div className="text-white/80 text-[12px]">
                                  Target: <span className="font-semibold">{currentTarget}</span>
                                </div>
                              </>
                            ),
                          });
                        }}
                        onMouseEnter={() => setActiveLegend("published")}
                        onMouseLeave={() => {
                          setActiveLegend(null);
                          setTooltip((prev) => ({ ...prev, isVisible: false }));
                        }}
                      >
                        {points.length <= 24 && <span className="column-bar-value">{point.published}</span>}
                      </div>
                    </div>
                    {/* Only render label text every Nth bar to avoid overflow */}
                    <div className="column-group-label" style={{ visibility: showLabel ? "visible" : "hidden" }}>
                      {point.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Horizontal legend */}
          <div className="column-chart-legend">
            <span
              className="column-chart-legend-item cursor-default transition-opacity"
              style={{ opacity: activeLegend && activeLegend !== "target" ? 0.3 : 1 }}
              onMouseEnter={() => setActiveLegend("target")}
              onMouseLeave={() => setActiveLegend(null)}
            >
              <span className="column-chart-legend-dot target" />
              Daily Target
            </span>
            <span
              className="column-chart-legend-item cursor-default transition-opacity"
              style={{ opacity: activeLegend && activeLegend !== "published" ? 0.3 : 1 }}
              onMouseEnter={() => setActiveLegend("published")}
              onMouseLeave={() => setActiveLegend(null)}
            >
              <span className="column-chart-legend-dot actual" />
              Published
            </span>
          </div>
        </div>
        <ChartTooltip {...tooltip} />
      </div>
    );
  }

  // Stacked breakdown by stage or category.
  const keys =
    dimension === "stage"
      ? STATUS_ORDER.filter((s) => points.some((p) => (p.byStage[s] ?? 0) > 0))
      : Array.from(
          new Set(points.flatMap((p) => Object.keys(p.byCategory))),
        ).sort();

  const colorFor = (key: string) =>
    dimension === "stage" ? STATUS_HEX[key as keyof typeof STATUS_HEX] : categoryColor(key);

  const valuesFor = (p: DailyProgressPoint) =>
    dimension === "stage" ? p.byStage : p.byCategory;

  const dayTotal = (p: DailyProgressPoint) =>
    keys.reduce((sum, k) => sum + (valuesFor(p)[k] ?? 0), 0);

  const axisMax = Math.max(...points.map(dayTotal), 1);

  return (
    <div>
      {toggle}
      <div className="column-chart">
        <div className="column-chart-body">
          <div className="column-chart-plot">
            {points.map((point, idx) => {
              const values = valuesFor(point);
              const showLabel = idx % step === 0 || idx === points.length - 1;
              return (
                <div key={point.date} className="column-group">
                  <div className="stacked-day-bar">
                    {keys.map((key) => {
                      const v = values[key] ?? 0;
                      if (v === 0) return null;
                      return (
                        <div
                          key={key}
                          className="stacked-day-seg"
                          style={{
                            height: `${(v / axisMax) * 100}%`,
                            background: colorFor(key),
                            opacity: activeLegend && activeLegend !== key ? 0.25 : 1,
                            transition: "opacity 0.2s ease, filter 0.2s ease",
                            cursor: "pointer",
                            filter: activeLegend === key ? "brightness(1.1)" : "none",
                          }}
                          onMouseMove={(e) => {
                            setTooltip({
                              isVisible: true,
                              x: e.clientX,
                              y: e.clientY,
                              content: (
                                <>
                                  <div className="font-medium text-[11px] text-white/60 mb-1">{point.label}</div>
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colorFor(key) }} />
                                    <span className="font-semibold text-[12px]">{key}</span>
                                  </div>
                                  <div className="text-white/80">{v} products</div>
                                </>
                              ),
                            });
                          }}
                          onMouseEnter={() => setActiveLegend(key)}
                          onMouseLeave={() => {
                            setActiveLegend(null);
                            setTooltip((prev) => ({ ...prev, isVisible: false }));
                          }}
                        />
                      );
                    })}
                  </div>
                  <div className="column-group-label" style={{ visibility: showLabel ? "visible" : "hidden" }}>
                    {point.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {/* Horizontal compact legend — replaces tall vertical list */}
        <HorizontalLegend
          keys={keys}
          colorFor={colorFor}
          activeLegend={activeLegend}
          onEnter={setActiveLegend}
          onLeave={() => setActiveLegend(null)}
        />
      </div>
      <ChartTooltip {...tooltip} />
    </div>
  );
}
