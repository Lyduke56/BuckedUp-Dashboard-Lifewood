import React from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  overline?: string;
}

export function PageHeader({ title, subtitle, overline }: PageHeaderProps) {
  // If the title contains " | ", we split it for the two-tone highlight
  const hasSplit = title.includes(" | ");
  const mainPart = hasSplit ? title.split(" | ")[0] : title;
  const accentPart = hasSplit ? ` | ${title.split(" | ")[1]}` : "";

  return (
    <div className="page-header-container mb-6">
      {overline && <div className="page-overline">{overline}</div>}
      <h1 className="page-title">
        {mainPart}
        {accentPart && <span className="title-accent">{accentPart}</span>}
      </h1>
      {subtitle && <p className="page-subtitle">{subtitle}</p>}
    </div>
  );
}
