"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useDashboard } from "@/contexts/DashboardContext";
import { productDone } from "@/lib/productHelpers";
import { FileList } from "@/components/library/FileList";
import { VideoPreviewModal } from "@/components/library/VideoPreviewModal";
import { VideoItem } from "@/lib/types";

export default function ProductDetailPage() {
  const params = useParams<{ productId: string }>();
  const router = useRouter();
  const { products, toggleVideoPublished } = useDashboard();
  const [previewItem, setPreviewItem] = useState<VideoItem | null>(null);

  const rank = Number(params.productId);
  const product = products.find((p) => p.rank === rank);

  if (!product) {
    return (
      <div className="animate-fadeUp">
        <button
          onClick={() => router.push("/library")}
          className="mb-4 flex items-center gap-2 text-[12.5px] font-bold text-ink-soft hover:text-castleton"
        >
          ← Back to video library
        </button>
        <div className="rounded-card border border-dashed border-line bg-white p-11 text-center text-[13px] font-semibold text-neutral-2">
          This product isn&apos;t in the dashboard — it may have been
          removed. Head back to the library to see what&apos;s active.
        </div>
      </div>
    );
  }

  const done = productDone(product);
  const total = product.items.length;

  return (
    <div className="animate-fadeUp">
      <Link
        href="/library"
        className="mb-4 flex items-center gap-2 text-[12.5px] font-bold text-ink-soft hover:text-castleton"
      >
        ← Back to video library
      </Link>
      <h1 className="mb-[3px] text-base font-extrabold text-serpent">
        {product.name}
      </h1>
      <p className="mb-[18px] text-[12.5px] font-semibold text-ink-soft">
        {product.category} › {product.subcategory} · Rank #{product.rank} ·{" "}
        {done}/{total} videos published
      </p>

      <FileList
        product={product}
        onToggle={(itemId) => toggleVideoPublished(product.rank, itemId)}
        onPreview={setPreviewItem}
      />

      <VideoPreviewModal
        product={product}
        item={
          previewItem
            ? product.items.find((it) => it.id === previewItem.id) ?? null
            : null
        }
        onClose={() => setPreviewItem(null)}
        onToggle={(itemId) => toggleVideoPublished(product.rank, itemId)}
      />
    </div>
  );
}
