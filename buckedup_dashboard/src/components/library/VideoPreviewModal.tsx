"use client";

import { Product, VideoItem } from "@/lib/types";

interface VideoPreviewModalProps {
  product: Product;
  item: VideoItem | null;
  onClose: () => void;
  onToggle: (itemId: string) => void;
}

export function VideoPreviewModal({
  product,
  item,
  onClose,
  onToggle,
}: VideoPreviewModalProps) {
  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-serpent/55 p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[560px] rounded-2xl bg-white p-[22px]">
        <div className="mb-3.5 flex items-start justify-between">
          <div>
            <h3 className="text-[15.5px] font-extrabold text-serpent">
              {item.name}
            </h3>
            <p className="mt-0.5 text-xs font-semibold text-ink-soft">
              {product.name} · {product.category} › {product.subcategory}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 rounded-lg bg-seasalt text-sm font-bold text-ink-soft"
          >
            ✕
          </button>
        </div>

        <div className="flex aspect-video flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-line bg-seasalt text-ink-soft">
          <svg
            viewBox="0 0 24 24"
            width="38"
            height="38"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            className="opacity-50"
          >
            <path d="M15 10l4.55-2.4A1 1 0 0121 8.5v7a1 1 0 01-1.45.9L15 14M4 6h9a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z" />
          </svg>
          <div className="text-[13px] font-extrabold text-ink">
            No video uploaded yet
          </div>
          <div className="text-[11.5px] font-semibold">
            This slot will hold the AIGC video once produced
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span
            className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-extrabold ${
              item.published
                ? "bg-castleton/15 text-castleton"
                : "bg-neutral-4 text-neutral-1"
            }`}
          >
            {item.published ? "Published" : "Not started"}
          </span>
          <button
            type="button"
            onClick={() => onToggle(item.id)}
            className="rounded-[9px] bg-serpent px-4 py-2.5 text-xs font-bold text-white hover:bg-[#0a1f14]"
          >
            {item.published ? "Mark as not started" : "Mark as published"}
          </button>
        </div>
      </div>
    </div>
  );
}
