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
  );
}
