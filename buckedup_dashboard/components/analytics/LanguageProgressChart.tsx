import type { Product } from "@/lib/types";

interface LanguageProgressChartProps {
  products: Product[];
}

export function LanguageProgressChart({
  products,
}: LanguageProgressChartProps) {
  const languages = Array.from(
    new Set(products.map((product) => product.language)),
  );

  const rows = languages
    .map((language) => {
      const items = products.filter(
        (product) => product.language === language,
      );
      const delivered = items.filter(
        (product) => product.reviewStatus === "Accepted",
      ).length;
      return { language, total: items.length, delivered };
    })
    .sort((a, b) => b.total - a.total);

  return (
    <>
      {rows.map((row) => {
        const pct =
          row.total === 0 ? 0 : Math.round((row.delivered / row.total) * 100);
        return (
          <div key={row.language} className="cat2-row">
            <div className="cat2-label">{row.language}</div>
            <div className="cat2-track">
              <div className="cat2-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="cat2-count">
              {row.delivered}/{row.total} accepted
            </div>
          </div>
        );
      })}
    </>
  );
}
