import { products } from "@/lib/data";

export function OverviewSnapshot() {
  const counts: Record<string, number> = {};
  products.forEach((product) => {
    counts[product.category] = (counts[product.category] || 0) + 1;
  });

  const active = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...active.map((entry) => entry[1]));

  return (
    <>
      {active.map(([category, count]) => (
        <div key={category} className="snapshot-row">
          <div className="snapshot-label">{category}</div>
          <div className="snapshot-track">
            <div
              className="snapshot-fill"
              style={{ width: `${(count / max) * 100}%` }}
            />
          </div>
          <div className="snapshot-count">{count} requested</div>
        </div>
      ))}
    </>
  );
}
