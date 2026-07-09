"use client";

import { useRef, useCallback } from "react";
import { computeProjectPacing } from "@/lib/data";
import type { Product } from "@/lib/types";
import { averageProgressPct } from "@/lib/utils";

interface ProjectProgressCardProps {
  products: Product[];
}

export function ProjectProgressCard({ products }: ProjectProgressCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const shimmerRef = useRef<HTMLDivElement>(null);

  const progressPct = Math.round(averageProgressPct(products));
  const { status, statusHex, daysToDeadline } =
    computeProjectPacing(progressPct);

  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const daysAbs = Math.abs(daysToDeadline);
  const deadlineText =
    daysToDeadline >= 0
      ? `${daysAbs} day${daysAbs === 1 ? "" : "s"} to delivery`
      : `Overdue by ${daysAbs} day${daysAbs === 1 ? "" : "s"}`;

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    const glow = glowRef.current;
    const shimmer = shimmerRef.current;
    if (!card || !glow || !shimmer) return;

    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    // Tilt
    const tiltX = ((y - cy) / cy) * 3;
    const tiltY = ((cx - x) / cx) * 3;
    card.style.transform = `perspective(800px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(1.01)`;

    // Direct positioning for maximum reliability
    glow.style.left = `${x}px`;
    glow.style.top = `${y}px`;
    glow.style.opacity = "1";

    const pctX = (x / rect.width) * 100;
    const pctY = (y / rect.height) * 100;
    shimmer.style.background = `radial-gradient(circle at ${pctX}% ${pctY}%, var(--progress-card-shimmer-color) 0%, transparent 65%)`;
    shimmer.style.opacity = "1";
  }, []);

  const handleMouseLeave = useCallback(() => {
    const card = cardRef.current;
    const glow = glowRef.current;
    const shimmer = shimmerRef.current;
    if (!card || !glow || !shimmer) return;
    card.style.transform = "perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)";
    glow.style.opacity = "0";
    shimmer.style.opacity = "0";
  }, []);

  return (
    <div
      ref={cardRef}
      className="progress-banner"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        position: "relative",
        overflow: "hidden",
        transition: "transform 0.15s ease",
        willChange: "transform",
      }}
    >
      {/* Cursor-tracking radial glow */}
      <div
        ref={glowRef}
        style={{
          position: "absolute",
          width: "280px",
          height: "280px",
          borderRadius: "50%",
          background: "var(--progress-card-mouse-glow)",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
          opacity: 0,
          transition: "opacity 0.3s ease",
          zIndex: 0,
        }}
      />
      {/* Full-card shimmer overlay */}
      <div
        ref={shimmerRef}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: 0,
          transition: "opacity 0.3s ease",
          zIndex: 0,
        }}
      />

      {/* Card content */}
      <div style={{ position: "relative", zIndex: 1, display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div className="progress-banner-main">
          <div className="progress-pct">{progressPct}%</div>
          <div>
            <div className="progress-label">complete</div>
            <span
              className="progress-status-pill"
              style={{ background: statusHex }}
            >
              {status}
            </span>
          </div>
        </div>
        <div className="progress-banner-dates">
          <div className="progress-deadline">{deadlineText}</div>
          <div className="progress-today">{today}</div>
        </div>
      </div>
      
      <div style={{ position: "relative", zIndex: 1, width: '100%', marginTop: '20px' }}>
        <div style={{ height: '8px', background: 'var(--glass-border)', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--glass-bg)' }}>
          <div style={{ width: `${progressPct}%`, height: '100%', background: 'var(--progress-card-bar-bg)', borderRadius: '10px', boxShadow: 'var(--progress-card-bar-glow)', transition: 'width 0.8s cubic-bezier(0.25, 1, 0.5, 1)' }} />
        </div>
      </div>
    </div>
  );
}
