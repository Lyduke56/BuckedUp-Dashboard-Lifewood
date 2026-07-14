"use client";

import { STATUS_CLASS } from "@/lib/data";
import type { Product } from "@/lib/types";
import { getModalKey } from "@/lib/utils";

interface ProductThumbnailGridProps {
  products: Product[];
  onOpenModal: (key: string) => void;
}

// Drill-down level of the Grid view: the thumbnails of one category's
// products. Clicking a thumbnail opens the existing VideoModal (same as a
// List row / Kanban card click).
export function ProductThumbnailGrid({ products, onOpenModal }: ProductThumbnailGridProps) {
  if (products.length === 0) {
    return <div className="empty-state">No videos in this category yet.</div>;
  }

  return (
    <div className="thumb-grid">
      {products.map((product) => {
        const status = product.items[0].status;
        return (
          <button
            key={product.rank}
            type="button"
            className="thumb-card"
            onClick={() => onOpenModal(getModalKey(product.rank, 0))}
          >
            <div className="thumb-card-img">
              {product.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.thumbnailUrl} alt={`${product.name} thumbnail`} />
              ) : (
                <div className="thumb-card-placeholder">
                  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                </div>
              )}
              <span className={`thumb-card-stage status-pill ${STATUS_CLASS[status]}`}>
                {status}
              </span>
            </div>
            <div className="thumb-card-title" title={product.name}>
              {product.name}
            </div>
            <div className="thumb-card-sub">{product.subcategory}</div>
          </button>
        );
      })}
    </div>
  );
}
