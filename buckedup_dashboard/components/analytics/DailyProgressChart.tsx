import { DAILY_VIDEO_TARGET } from "@/lib/data";
import type { DailyCompletionPoint } from "@/lib/types";

interface DailyProgressChartProps {
  points: DailyCompletionPoint[];
}

export function DailyProgressChart({ points }: DailyProgressChartProps) {
  if (points.length === 0) {
    return (
      <div className="empty-state">
        No daily history yet — this needs a periodic snapshot job (see
        04-architecture.md, Phase 4), since Google Sheets doesn&apos;t retain
        a change history this could be reconstructed from. Configured daily
        target: {DAILY_VIDEO_TARGET} videos/day.
      </div>
    );
  }

  const max = Math.max(
    ...points.map((point) => Math.max(point.target, point.actual)),
    1,
  );

  return (
    <>
      <div className="sample-data-badge">Sample data — not live</div>
      {points.map((point) => (
        <div key={point.date} className="daily-row">
          <div className="daily-label">{point.date}</div>
          <div className="daily-track">
            <div
              className="daily-fill"
              style={{ width: `${(point.actual / max) * 100}%` }}
            />
            <div
              className="daily-target-tick"
              style={{ left: `${(point.target / max) * 100}%` }}
            />
          </div>
          <div className="daily-count">
            {point.actual}/{point.target}
          </div>
        </div>
      ))}
    </>
  );
}
