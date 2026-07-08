// components/Card.tsx
"use client";

import type { CSSProperties, KeyboardEvent, ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  height?: number;
  onClick?: () => void;
  className?: string;
  variant?: "default" | "accent" | "folder";
}

export function Card({
  children,
  height,
  onClick,
  className,
  variant = "default",
}: CardProps) {
  const interactive = Boolean(onClick);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onClick) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  };

  const style: CSSProperties | undefined = height
    ? { height: `${height}px` }
    : undefined;

  // folder-card is a named class in the stylesheet (hover/transform/etc),
  // not a "card-<variant>" pattern like default/accent, so it needs its
  // own branch here rather than falling into the generic template.
  const variantClass = variant === "folder" ? "folder-card" : `card-${variant}`;
  const rootClassName = `card ${variantClass}${className ? ` ${className}` : ""}`;

  const sharedProps = {
    className: rootClassName,
    style,
    onClick,
    onKeyDown: interactive ? handleKeyDown : undefined,
    role: interactive ? "button" : undefined,
    tabIndex: interactive ? 0 : undefined,
  };

  if (variant === "folder") {
    return (
      <div {...sharedProps}>
        <div className="folder-card-body">{children}</div>
      </div>
    );
  }

  return <div {...sharedProps}>{children}</div>;
}