interface StageAgeBadgeProps {
  days: number | undefined;
}

// Thresholds are a judgment call, not a config surface yet: under a week
// reads as normal pace, 1-2 weeks worth flagging, beyond that is stale.
function ageClass(days: number): string {
  if (days >= 14) return "stage-age-stale";
  if (days >= 7) return "stage-age-warn";
  return "stage-age-ok";
}

export function StageAgeBadge({ days }: StageAgeBadgeProps) {
  if (days === undefined) return null;

  return (
    <span className={`stage-age-badge ${ageClass(days)}`}>
      {days === 0 ? "today" : `${days}d`}
    </span>
  );
}
