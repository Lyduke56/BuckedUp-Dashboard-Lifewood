interface ProgressBarProps {
  percent: number;
  height?: number;
  trackClassName?: string;
  fillClassName?: string;
}

export function ProgressBar({
  percent,
  height = 6,
  trackClassName = "bg-seasalt",
  fillClassName = "bg-castleton",
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      className={`overflow-hidden rounded-full ${trackClassName}`}
      style={{ height }}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-300 ${fillClassName}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
