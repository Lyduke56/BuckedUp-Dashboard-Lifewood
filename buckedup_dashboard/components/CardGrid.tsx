// components/CardGrid.tsx
"use client";

import type { ReactNode } from "react";

interface CardGridProps {
  columns: number;
  children: ReactNode;
  className?: string;
}

export function CardGrid({ columns, children, className }: CardGridProps) {
  return (
    <div
      className={`card-grid${className ? ` ${className}` : ""}`}
      style={{ "--grid-columns": columns } as React.CSSProperties}
    >
      {children}
    </div>
  );
}