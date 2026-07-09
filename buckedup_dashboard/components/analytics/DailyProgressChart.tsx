import { DAILY_VIDEO_TARGET } from "@/lib/data";
import type { DailyCompletionPoint } from "@/lib/types";

interface DailyProgressChartProps {
  points: DailyCompletionPoint[];
  dailyTarget?: number;
}

export function DailyProgressChart({
  points,
  dailyTarget = DAILY_VIDEO_TARGET,
}: DailyProgressChartProps) {
  if (points.length === 0) {
    return (
      <div className="empty-state">
        No daily history yet — Supabase only holds current state, not a
        change log, so this needs a periodic snapshot job (e.g. a scheduled
        function that records daily completion counts) before this chart can
        populate. Configured daily target: {dailyTarget} videos/day.
      </div>
    );
  }

  const max = Math.max(
    ...points.map((point) => Math.max(point.target, point.actual)),
    1,
  );
  const axisMax = Math.ceil(max / 3) * 3 || 3;
  const ticks = [3, 2, 1, 0].map((step) => Math.round((axisMax / 3) * step));

  return (
    <div className="column-chart">
      <div className="sample-data-badge">Sample data — not live</div>
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
                  style={{ height: `${(point.target / axisMax) * 100}%` }}
                >
                  <span className="column-bar-value">{point.target}</span>
                </div>
                <div
                  className="column-bar column-bar-actual"
                  style={{ height: `${(point.actual / axisMax) * 100}%` }}
                >
                  <span className="column-bar-value">{point.actual}</span>
                </div>
              </div>
              <div className="column-group-label">{point.date}</div>
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
          Actual
        </span>
      </div>
    </div>
  );
}
