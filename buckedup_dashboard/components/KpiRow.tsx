import { products } from "@/lib/data";
import { productBucket, totalVideos } from "@/lib/utils";

export function KpiRow() {
  const total = products.length;
  const published = products.filter((p) => productBucket(p) === "published").length;
  const inProgress = products.filter((p) => productBucket(p) === "in-progress").length;
  const notStarted = products.filter((p) => productBucket(p) === "not-started").length;

  const kpis = [
    { n: total, l: "Products requested", cls: "" },
    { n: totalVideos(products), l: "Videos planned", cls: "" },
    { n: published, l: "Published", cls: "c-published" },
    { n: inProgress, l: "In progress", cls: "c-progress" },
    { n: notStarted, l: "Not started", cls: "c-notstarted" },
  ];

  return (
    <div className="kpi-row">
      {kpis.map((kpi) => (
        <div key={kpi.l} className={`kpi-card ${kpi.cls}`}>
          <div className="kpi-number">{kpi.n}</div>
          <div className="kpi-label">{kpi.l}</div>
          <div className="kpi-bar" />
        </div>
      ))}
    </div>
  );
}
