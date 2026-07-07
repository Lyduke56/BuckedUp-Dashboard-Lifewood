"use client";

import { Product, VideoItem } from "@/lib/types";

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M10 8.5l6 3.5-6 3.5z" fill="currentColor" stroke="none" />
    </svg>
  );
}

interface FileListProps {
  product: Product;
  onToggle: (itemId: string) => void;
  onPreview: (item: VideoItem) => void;
}

export function FileList({ product, onToggle, onPreview }: FileListProps) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-white">
      <div className="grid grid-cols-[40px_46px_1fr_130px_90px] items-center gap-3.5 border-b border-line px-[18px] py-[13px] text-[10.5px] font-bold uppercase tracking-wide text-ink-soft">
        <div />
        <div />
        <div>Video item</div>
        <div>Status</div>
        <div>Preview</div>
      </div>

      {product.items.map((item) => (
        <div
          key={item.id}
          className="grid cursor-pointer grid-cols-[40px_46px_1fr_130px_90px] items-center gap-3.5 border-t border-seasalt px-[18px] py-[13px] hover:bg-seasalt"
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(item.id);
            }}
            className={`flex h-[19px] w-[19px] flex-shrink-0 items-center justify-center rounded-[5px] border-2 ${
              item.published
                ? "border-castleton bg-castleton text-white"
                : "border-line bg-white"
            }`}
          >
            {item.published && (
              <span className="text-xs font-extrabold leading-none">✓</span>
            )}
          </button>

          <div className="flex h-8 w-[46px] items-center justify-center rounded-md border border-dashed border-line bg-seasalt text-ink-soft">
            <span className="h-3.5 w-3.5">
              <PlayIcon />
            </span>
          </div>

          <div
            onClick={() => onPreview(item)}
            className="text-[13px] font-bold"
          >
            {item.name}
            {item.variant && (
              <span className="mt-0.5 block text-[11px] font-medium text-ink-soft">
                {item.variant}
              </span>
            )}
          </div>

          <div>
            <span
              className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-extrabold ${
                item.published
                  ? "bg-castleton/15 text-castleton"
                  : "bg-neutral-4 text-neutral-1"
              }`}
            >
              {item.published ? "Published" : "Not started"}
            </span>
          </div>

          <div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPreview(item);
              }}
              className="rounded-lg bg-castleton/[.08] px-3 py-1.5 text-[11px] font-bold text-castleton hover:bg-castleton/[.15]"
            >
              Preview
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
