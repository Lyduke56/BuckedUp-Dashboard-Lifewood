"use client";

import { useState } from "react";
import { DAILY_VIDEO_TARGET, STATUS_HEX, STATUS_ORDER } from "@/lib/data";
import { categoryColor } from "@/lib/colors";
import type { DailyProgressPoint } from "@/lib/useDailyProgress";

interface DailyProgressChartProps {
  points: DailyProgressPoint[];
  dailyTarget?: number;
}

type Dimension = "overall" | "stage" | "category";

export function DailyProgressChart({
  points,
  dailyTarget = DAILY_VIDEO_TARGET,
}: DailyProgressChartProps) {
  const [dimension, setDimension] = useState<Dimension>("overall");

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
          No pipeline activity in the last {points.length} days yet — this
          populates live as products move through their stages. Configured
          daily target: {dailyTarget} videos/day.
        </div>
      </div>
    );
  }

  if (dimension === "overall") {
    const max = Math.max(
      ...points.map((p) => Math.max(dailyTarget, p.published)),
      1,
    );
    const axisMax = Math.ceil(max / 3) * 3 || 3;
    const ticks = [3, 2, 1, 0].map((step) => Math.round((axisMax / 3) * step));

    return (
      <div>
        {toggle}
        <div className="column-chart">
          <div className="column-chart-body">
            <div className="column-chart-axis">
              {ticks.map((tick, index) => (
                <div key={`${tick}-${index}`} className="column-chart-tick">
                  {tick}
                </div>
              ))}
            </div>
            <div className="column-chart-plot">
              {points.map((point) => (
                <div key={point.date} className="column-group">
                  <div className="column-bars">
                    <div
                      className="column-bar column-bar-target"
                      style={{ height: `${(dailyTarget / axisMax) * 100}%` }}
                    >
                      <span className="column-bar-value">{dailyTarget}</span>
                    </div>
                    <div
                      className="column-bar column-bar-actual"
                      style={{ height: `${(point.published / axisMax) * 100}%` }}
                    >
                      <span className="column-bar-value">{point.published}</span>
                    </div>
                  </div>
                  <div className="column-group-label">{point.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="column-chart-legend">
            <span className="column-chart-legend-item">
              <span className="column-chart-legend-dot target" />
              Daily Target
            </span>
            <span className="column-chart-legend-item">
              <span className="column-chart-legend-dot actual" />
              Published
            </span>
          </div>
        </div>
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
            {points.map((point) => {
              const values = valuesFor(point);
              return (
                <div key={point.date} className="column-group">
                  <div
                    className="stacked-day-bar"
                    title={`${point.label}: ${dayTotal(point)} total`}
                  >
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
                          }}
                          title={`${key}: ${v}`}
                        />
                      );
                    })}
                  </div>
                  <div className="column-group-label">{point.label}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="category-legend" style={{ marginTop: "12px" }}>
          {keys.map((key) => (
            <div key={key} className="category-legend-item">
              <span className="category-legend-dot" style={{ background: colorFor(key) }} />
              {key}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
