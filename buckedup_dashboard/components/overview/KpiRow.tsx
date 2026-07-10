// KpiRow.tsx
import type { Product } from "@/lib/types";
import { productBucket, totalVideos } from "@/lib/utils";
import { Card } from "@/components/shared/Card";
import { CardGrid } from "@/components/shared/CardGrid";
import React from 'react';
import { Tilt } from "@/components/shared/Tilt";

import { Package, Clapperboard, CheckCircle2, Clock, CircleDashed } from "lucide-react";

const ICONS: Record<string, React.ReactNode> = {
  package: <Package size={22} />,
  clapper: <Clapperboard size={22} />,
  published: <CheckCircle2 size={22} />,
  progress: <Clock size={22} />,
  notstarted: <CircleDashed size={22} />,
};

interface KpiRowProps {
  products: Product[];
  isLoading?: boolean;
  hasError?: boolean;
}

export function KpiRow({ products, isLoading, hasError }: KpiRowProps) {
  const total = products.length;
  const uniqueCategories = new Set(products.map((p) => p.category)).size;
  const published = products.filter((p) => productBucket(p) === "published").length;
  const inProgress = products.filter((p) => productBucket(p) === "in-progress").length;
  const notStarted = products.filter((p) => productBucket(p) === "not-started").length;

  const displayVal = (val: number) => (isLoading || hasError ? "--" : val);

  const kpis = [
    { n: displayVal(uniqueCategories), l: "Categories Requested", cls: "c-categories", icon: "package" },
    { n: isLoading || hasError ? "--" : totalVideos(products), l: "Videos planned", cls: "c-planned", icon: "clapper" },
    { n: displayVal(published), l: "Published", cls: "c-published", icon: "published" },
    { n: displayVal(inProgress), l: "In progress", cls: "c-progress", icon: "progress" },
    { n: displayVal(notStarted), l: "Not started", cls: "c-notstarted", icon: "notstarted" },
  ];

  return (
    <CardGrid columns={5} className="kpi-row">
      {kpis.map((kpi) => (
        <Tilt key={kpi.l} maxTilt={8} className="kpi-tilt-wrapper" style={{ width: '100%' }}>
          <Card height={145} className={`kpi-card card-glass ${kpi.cls}`}>
            <div className="kpi-icon">{ICONS[kpi.icon]}</div>
            <div className="kpi-number">{kpi.n}</div>
            <div className="kpi-label">{kpi.l}</div>
          </Card>
        </Tilt>
      ))}
    </CardGrid>
  );
}