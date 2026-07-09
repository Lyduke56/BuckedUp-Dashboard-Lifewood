"use client";

import React, { useRef, useState } from "react";

interface TiltProps {
  children: React.ReactNode;
  maxTilt?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function Tilt({ children, maxTilt = 10, className = "", style = {} }: TiltProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState("perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)");
  const [transition, setTransition] = useState("transform 0.5s ease-out");

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    const x = e.clientX - rect.left - width / 2;
    const y = e.clientY - rect.top - height / 2;

    const px = x / width;
    const py = y / height;

    const tiltX = -py * maxTilt;
    const tiltY = px * maxTilt;

    setTransition("transform 0.15s cubic-bezier(0.25, 1, 0.5, 1)");
    setTransform(
      `perspective(1000px) rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg) scale3d(1.02, 1.02, 1.02)`
    );
  };

  const handleMouseEnter = () => {
    setTransition("transform 0.15s cubic-bezier(0.25, 1, 0.5, 1)");
  };

  const handleMouseLeave = () => {
    setTransition("transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)");
    setTransform("perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)");
  };

  return (
    <div
      ref={ref}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        ...style,
        transform,
        transition,
        transformStyle: "preserve-3d",
      }}
    >
      {children}
    </div>
  );
}
