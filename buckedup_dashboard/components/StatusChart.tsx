import { products, STATUS_HEX, STATUS_ORDER } from "@/lib/data";

export function StatusChart() {
  const counts: Record<string, number> = {};
  STATUS_ORDER.forEach((status) => {
    counts[status] = 0;
  });
  products.forEach((product) =>
    product.items.forEach((item) => {
      counts[item.status]++;
    }),
  );

  const max = Math.max(...Object.values(counts), 1);

  return (
    <>
      {STATUS_ORDER.map((status) => (
        <div key={status} className="bar-row">
          <div className="bar-label">{status}</div>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{
                width: `${(counts[status] / max) * 100}%`,
                background: STATUS_HEX[status],
              }}
            />
          </div>
          <div className="bar-count">{counts[status]}</div>
        </div>
      ))}
    </>
  );
}
