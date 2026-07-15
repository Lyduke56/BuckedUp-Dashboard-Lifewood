"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface ChartTooltipProps {
  isVisible: boolean;
  x: number;
  y: number;
  content: React.ReactNode;
  borderColor?: string;
}

export function ChartTooltip({ isVisible, x, y, content, borderColor }: ChartTooltipProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          style={{
            position: "fixed",
            left: x + 15,
            top: y + 15,
            zIndex: 9999,
            pointerEvents: "none",
            borderColor: borderColor || undefined,
            borderWidth: borderColor ? "1.5px" : undefined,
          }}
          className="bg-[#111111]/95 backdrop-blur-md text-white text-[11px] font-medium px-2.5 py-1.5 rounded shadow-xl border border-white/10 flex flex-col gap-0.5 whitespace-nowrap"
        >
          {content}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
