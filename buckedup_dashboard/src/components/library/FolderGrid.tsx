import { Product } from "@/lib/types";
import { FolderCard } from "@/components/library/FolderCard";

interface FolderGridProps {
  products: Product[];
}

export function FolderGrid({ products }: FolderGridProps) {
  if (products.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-line bg-white p-11 text-center text-[13px] font-semibold text-neutral-2">
        No products currently requested in this category yet — it will
        appear here automatically once BuckedUp adds one.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3.5">
      {products.map((product) => (
        <FolderCard key={product.rank} product={product} />
      ))}
    </div>
  );
}
