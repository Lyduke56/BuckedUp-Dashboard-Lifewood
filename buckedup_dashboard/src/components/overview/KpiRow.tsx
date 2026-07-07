import { Product } from "@/lib/types";
import { totalVideos } from "@/lib/productHelpers";

interface KpiRowProps {
  products: Product[];
}

export function KpiRow({ products }: KpiRowProps) {
  const published = products.filter(
    (p) => p.items.length > 0 && p.items.every((it) => it.published)
  ).length;
  const notStarted = products.filter((p) =>
    p.items.every((it) => !it.published)
  ).length;
  const inProgress = products.length - published - notStarted;

  const kpis = [
    { number: products.length, label: "Products requested", tone: "" },
    { number: totalVideos(products), label: "Videos planned", tone: "" },
    { number: published, label: "Published", tone: "text-castleton" },
    { number: inProgress, label: "In progress", tone: "text-[#a15e00]" },
    { number: notStarted, label: "Not started", tone: "text-neutral-1" },
  ];

  return (
    <div className="mb-[26px] grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
      {kpis.map((kpi) => (
        <div
          key={kpi.label}
          className="rounded-card border border-line bg-white p-[18px]"
        >
          <div
            className={`text-[28px] font-extrabold tracking-tight ${kpi.tone}`}
          >
            {kpi.number}
          </div>
          <div className="mt-1.5 text-xs font-bold uppercase tracking-wide text-ink-soft">
            {kpi.label}
          </div>
          <div className="mt-2.5 h-[3px] w-[26px] rounded bg-saffron" />
        </div>
      ))}
    </div>
  );
}
