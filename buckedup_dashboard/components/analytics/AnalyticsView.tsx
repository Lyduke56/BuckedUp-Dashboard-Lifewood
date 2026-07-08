export function AnalyticsView() {
  return (
    <div>
      <div className="section-heading">Analytics</div>
      <div className="section-sub">
        Completion velocity, bottleneck detection, and exportable reports —
        this tab is scaffolded and ready to be built out.
      </div>
      <div className="empty-state">
        Nothing here yet. This requires periodic snapshots of the Sheet to
        compute trends over time, since Google Sheets itself doesn&apos;t
        retain change history.
      </div>
    </div>
  );
}
