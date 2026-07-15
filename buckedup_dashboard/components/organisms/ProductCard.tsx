import React from 'react';
import { ProductImage } from '@/components/atoms/ProductImage';
import { Badge } from '@/components/atoms/Badge';
import { ProductPrice } from '@/components/molecules/ProductPrice';
import { Button } from '@/components/atoms/Button';
import { ExternalLink, Video, Edit2, ChevronRight } from 'lucide-react';
import type { CatalogProduct } from '@/lib/types';

export interface ProductData {
  id: string;
  category: string;
  subcategory: string;
  name: string;
  variants: string;
  variantCount: string;
  price: string;
  flag: string;
  link: string;
  aigcStatus?: "none" | "in-progress" | "published";
  rawCatalogProduct?: CatalogProduct;
}

interface ProductCardProps {
  product: ProductData;
  onClick?: (product: ProductData) => void;
  onEdit?: (product: ProductData, e: React.MouseEvent) => void;
  onViewInLibrary?: (product: ProductData, e: React.MouseEvent) => void;
  isLead?: boolean;
}

export function ProductCard({
  product,
  onClick,
  onEdit,
  onViewInLibrary,
  isLead,
}: ProductCardProps) {
  // Parse flag/status for badges
  const isNew = product.flag.toUpperCase().includes('NEW');
  const isBestSeller = product.flag.toUpperCase().includes('BEST SELLER');

  return (
    <div
      className="card card-default flex flex-col h-full gap-4 transition-all hover:-translate-y-1 cursor-pointer"
      onClick={() => onClick?.(product)}
    >
      <div className="relative">
        <ProductImage alt={product.name} src={product.rawCatalogProduct?.thumbnailUrl || undefined} />
        <div className="absolute top-2 left-2 flex flex-col gap-2">
          {isNew && <Badge variant="success">NEW</Badge>}
          {isBestSeller && <Badge variant="default">Best Seller</Badge>}
        </div>
        {product.aigcStatus && (
          <div className="absolute top-2 right-2 flex flex-col gap-2 items-end">
            {product.aigcStatus === "published" && (
              <Badge variant="success" className="bg-[var(--castleton)] text-white shadow-md font-semibold">
                Published
              </Badge>
            )}
            {product.aigcStatus === "in-progress" && (
              <Badge variant="warning" className="bg-amber-500 text-black font-semibold shadow-md">
                In Progress
              </Badge>
            )}
            {product.aigcStatus === "none" && (
              <Badge variant="outline" className="bg-neutral-900/85 text-neutral-400 border border-neutral-700 font-medium">
                No Video
              </Badge>
            )}
          </div>
        )}
      </div>
      
      <div className="flex flex-col flex-1 gap-2">
        <div className="text-xs text-[var(--ink-soft)] font-medium uppercase tracking-wider">
          {product.category}
        </div>
        
        <h3 className="text-sm font-bold text-[var(--text-main)] leading-tight line-clamp-2" title={product.name}>
          {product.name}
        </h3>
        
        <div className="mt-auto pt-3 flex items-center justify-between">
          <ProductPrice price={product.price} />
          {product.link && (
            <a
              href={product.link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" title="View on BuckedUp">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </a>
          )}
        </div>

        {/* Quick Actions Bar */}
        {(onClick || onEdit || onViewInLibrary) && (
          <div className="mt-2 pt-3 border-t border-[var(--glass-border)] flex items-center justify-between gap-2">
            {product.aigcStatus === "none" && (
              <span className="text-[11px] text-[var(--ink-muted)] font-medium">Not Requested</span>
            )}

            {product.aigcStatus && product.aigcStatus !== "none" && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs font-medium text-[var(--ink-soft)] hover:text-white gap-1"
                onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.stopPropagation();
                  onViewInLibrary?.(product, e);
                }}
              >
                <ChevronRight className="h-3 w-3" /> View in Library
              </Button>
            )}

            {isLead && onEdit && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-[var(--ink-soft)] hover:text-white ml-auto gap-1"
                title="Edit Product"
                onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.stopPropagation();
                  onEdit?.(product, e);
                }}
              >
                <Edit2 className="h-3 w-3" /> Edit
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
