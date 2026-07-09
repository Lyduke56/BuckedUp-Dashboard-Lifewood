import { computeProjectPacing } from "@/lib/data";
import type { Product } from "@/lib/types";
import { averageProgressPct } from "@/lib/utils";

interface ProjectProgressCardProps {
  products: Product[];
}

export function ProjectProgressCard({ products }: ProjectProgressCardProps) {
  const progressPct = Math.round(averageProgressPct(products));
  const { status, statusHex, daysToDeadline } =
    computeProjectPacing(progressPct);

  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const daysAbs = Math.abs(daysToDeadline);
  const deadlineText =
    daysToDeadline >= 0
      ? `${daysAbs} day${daysAbs === 1 ? "" : "s"} to delivery`
      : `Overdue by ${daysAbs} day${daysAbs === 1 ? "" : "s"}`;

  return (
    <div className="progress-banner">
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div className="progress-banner-main">
          <div className="progress-pct">{progressPct}%</div>
          <div>
            <div className="progress-label">complete</div>
            <span
              className="progress-status-pill"
              style={{ background: statusHex }}
            >
              {status}
            </span>
          </div>
        </div>
        <div className="progress-banner-dates">
          <div className="progress-deadline">{deadlineText}</div>
          <div className="progress-today">{today}</div>
        </div>
      </div>
      
      <div style={{ width: '100%', marginTop: '20px' }}>
        <div style={{ height: '8px', background: 'var(--glass-border)', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--glass-bg)' }}>
          <div style={{ width: `${progressPct}%`, height: '100%', background: 'linear-gradient(90deg, var(--saffron) 0%, #ff8c00 100%)', borderRadius: '10px', boxShadow: '0 0 12px rgba(255, 179, 71, 0.5)' }} />
        </div>
      </div>
    </div>
  );
}
