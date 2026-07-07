"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Product } from "@/lib/types";
import { productBucket, productDone } from "@/lib/productHelpers";
import { StatusPill } from "@/components/ui/StatusPill";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useDashboard } from "@/contexts/DashboardContext";

interface FolderCardProps {
  product: Product;
}

export function FolderCard({ product }: FolderCardProps) {
  const router = useRouter();
  const { removeProduct } = useDashboard();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const done = productDone(product);
  const total = product.items.length;
  const bucket = productBucket(product);

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => router.push(`/library/${product.rank}`)}
        onKeyDown={(e) => {
          if (e.key === "Enter") router.push(`/library/${product.rank}`);
        }}
        className="group relative cursor-pointer rounded-card border border-line bg-white p-4 transition hover:-translate-y-0.5 hover:border-castleton hover:shadow-[0_6px_18px_rgba(19,48,32,0.08)]"
      >
        <button
          type="button"
          title="Remove from dashboard"
          onClick={(e) => {
            e.stopPropagation();
            setConfirmOpen(true);
          }}
          className="absolute right-2 top-2 hidden h-6 w-6 items-center justify-center rounded-md text-neutral-2 hover:bg-red-50 hover:text-red-600 group-hover:flex"
        >
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>

        <div className="mb-3 flex items-start justify-between">
          <StatusPill bucket={bucket} />
          <div className="flex h-6 w-6 flex-shrink-0 rotate-45 items-center justify-center rounded-[5px] bg-serpent">
            <span className="-rotate-45 text-[10px] font-extrabold text-white">
              {product.rank}
            </span>
          </div>
        </div>
        <div className="mb-[3px] text-[13.5px] font-extrabold leading-snug">
          {product.name}
        </div>
        <div className="mb-3 text-[10.5px] font-semibold text-ink-soft">
          {product.category} › {product.subcategory} · {product.price}
        </div>
        <ProgressBar percent={(done / total) * 100} />
        <div className="mt-2.5 flex items-center justify-between">
          <span className="text-[11px] font-bold text-ink-soft">
            {done}/{total} video{total > 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Remove this product?"
        description={`"${product.name}" will be removed from the dashboard. This does not delete anything from the source catalog — it only tidies up this view.`}
        onConfirm={() => {
          removeProduct(product.rank);
          setConfirmOpen(false);
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
