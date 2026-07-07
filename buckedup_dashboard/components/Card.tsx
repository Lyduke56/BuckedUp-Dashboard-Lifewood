// components/Card.tsx
"use client";

import type { CSSProperties, KeyboardEvent, ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  height?: number;
  onClick?: () => void;
  className?: string;
  variant?: "default" | "accent" | "folder";
  /** Only used when variant="folder" — sets the color of the top strip */
  stripColor?: string;
}

export function Card({
  children,
  height,
  onClick,
  className,
  variant = "default",
  stripColor,
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

  const rootClassName = `card card-${variant}${
    className ? ` ${className}` : ""
  }`;

  const sharedProps = {
    className: rootClassName,
    style,
    onClick,
    onKeyDown: interactive ? handleKeyDown : undefined,
    role: interactive ? "button" : undefined,
    tabIndex: interactive ? 0 : undefined,
  };

  // Folder cards need a full-bleed strip + a padded body wrapper,
  // since .folder-card itself has padding: 0 and overflow: hidden.
  if (variant === "folder") {
    return (
      <div {...sharedProps}>
        <div
          className="folder-card-strip"
          style={stripColor ? { background: stripColor } : undefined}
        />
        <div className="folder-card-body">{children}</div>
      </div>
    );
  }

  return <div {...sharedProps}>{children}</div>;
}