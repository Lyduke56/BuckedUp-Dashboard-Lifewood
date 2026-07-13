"use client";

import type { CSSProperties } from "react";
import { CATEGORY_TREE } from "@/lib/data";
import { categoryColor } from "@/lib/colors";
import type { Product } from "@/lib/types";
import { categoryCountProducts } from "@/lib/utils";

interface CategoryFolderGridProps {
  products: Product[];
  onOpenFolder: (category: string) => void;
}

// Google-Drive-style top level of the Grid view: one folder tile per
// category, with a live count from the (already-filtered) products.
export function CategoryFolderGrid({ products, onOpenFolder }: CategoryFolderGridProps) {
  return (
    <div className="folder-grid">
      {Object.keys(CATEGORY_TREE).map((category) => {
        const count = categoryCountProducts(products, category);
        return (
          <button
            key={category}
            type="button"
            className="folder-tile"
            onClick={() => onOpenFolder(category)}
            style={{ "--folder-accent": categoryColor(category) } as CSSProperties}
          >
            <div className="folder-tile-icon">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
              </svg>
            </div>
            <div className="folder-tile-name" title={category}>
              {category}
            </div>
            <div className="folder-tile-count">
              {count} video{count === 1 ? "" : "s"}
            </div>
          </button>
        );
      })}
    </div>
  );
}
