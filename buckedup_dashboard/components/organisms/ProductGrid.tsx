import React from 'react';
import { ProductCard, ProductData } from './ProductCard';
import { LayoutGrid } from 'lucide-react';

interface ProductGridProps {
  products: ProductData[];
  onCardClick?: (product: ProductData) => void;
  onEdit?: (product: ProductData, e: React.MouseEvent) => void;
  onToggleActive?: (product: ProductData, e: React.MouseEvent) => void;
  onViewInLibrary?: (product: ProductData, e: React.MouseEvent) => void;
  canEdit?: boolean;
}

export function ProductGrid({
  products,
  onCardClick,
  onEdit,
  onToggleActive,
  onViewInLibrary,
  canEdit,
}: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 panel border-dashed">
        <LayoutGrid className="h-12 w-12 text-[var(--ink-soft)] opacity-50 mb-4" />
        <h3 className="text-lg font-medium text-[var(--text-main)]">No products found</h3>
        <p className="text-sm text-[var(--ink-soft)] text-center mt-2">
          Try adjusting your search or filters to find what you&apos;re looking for.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onClick={onCardClick}
          onEdit={onEdit}
          onToggleActive={onToggleActive}
          onViewInLibrary={onViewInLibrary}
          canEdit={canEdit}
        />
      ))}
    </div>
  );
}
