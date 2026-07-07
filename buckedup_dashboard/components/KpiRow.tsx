import type { Product } from "@/lib/types";
import { productBucket, totalVideos } from "@/lib/utils";

interface KpiRowProps {
  products: Product[];
  isLoading?: boolean;
  hasError?: boolean;
}

export function KpiRow({ products, isLoading, hasError }: KpiRowProps) {
  const total = products.length;
  const published = products.filter((p) => productBucket(p) === "published").length;
  const inProgress = products.filter((p) => productBucket(p) === "in-progress").length;
  const notStarted = products.filter((p) => productBucket(p) === "not-started").length;

  const displayVal = (val: number) => {
    if (isLoading || hasError) return "--";
    return val;
  };

  const kpis = [
    { n: displayVal(total), l: "Products requested", cls: "" },
    { n: isLoading || hasError ? "--" : totalVideos(products), l: "Videos planned", cls: "" },
    { n: displayVal(published), l: "Published", cls: "c-published" },
    { n: displayVal(inProgress), l: "In progress", cls: "c-progress" },
    { n: displayVal(notStarted), l: "Not started", cls: "c-notstarted" },
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
