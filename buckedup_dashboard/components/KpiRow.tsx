// KpiRow.tsx
import type { Product } from "@/lib/types";
import { productBucket, totalVideos } from "@/lib/utils";
import { Card } from "./Card";
import { CardGrid } from "./CardGrid";
import React from 'react';

const ICONS: Record<string, React.ReactNode> = {
  package: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8l-9-5-9 5 9 5 9-5z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </svg>
  ),
  clapper: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8l2-4h3l-2 4" />
      <path d="M10 8l2-4h3l-2 4" />
      <path d="M16 8l2-4h2v4" />
      <rect x="3" y="8" width="18" height="12" rx="2" />
    </svg>
  ),
  published: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  progress: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6v6l4 2" />
    </svg>
  ),
  notstarted: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  ),
};

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

  const displayVal = (val: number) => (isLoading || hasError ? "--" : val);

  const kpis = [
    { n: displayVal(total), l: "Products requested", cls: "c-neutral", icon: "package" },
    { n: isLoading || hasError ? "--" : totalVideos(products), l: "Videos planned", cls: "c-neutral", icon: "clapper" },
    { n: displayVal(published), l: "Published", cls: "c-published", icon: "published" },
    { n: displayVal(inProgress), l: "In progress", cls: "c-progress", icon: "progress" },
    { n: displayVal(notStarted), l: "Not started", cls: "c-notstarted", icon: "notstarted" },
  ];

  return (
    <CardGrid columns={5} className="kpi-row">
      {kpis.map((kpi) => (
        <Card key={kpi.l} height={130} className={`kpi-card ${kpi.cls}`}>
          <div className="kpi-icon">{ICONS[kpi.icon]}</div>
          <div className="kpi-number">{kpi.n}</div>
          <div className="kpi-label">{kpi.l}</div>
        </Card>
      ))}
    </CardGrid>
  );
}