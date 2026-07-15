import React from 'react';
import { ProductImage } from '@/components/atoms/ProductImage';
import { Badge } from '@/components/atoms/Badge';
import { ProductPrice } from '@/components/molecules/ProductPrice';
import { Button } from '@/components/atoms/Button';
import { ExternalLink } from 'lucide-react';

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
}

interface ProductCardProps {
  product: ProductData;
}

export function ProductCard({ product }: ProductCardProps) {
  // Parse flag/status for badges
  const isNew = product.flag.toUpperCase().includes('NEW');
  const isBestSeller = product.flag.toUpperCase().includes('BEST SELLER');

  return (
    <div className="card card-default flex flex-col h-full gap-4 transition-all hover:-translate-y-1">
      <div className="relative">
        <ProductImage alt={product.name} />
        <div className="absolute top-2 left-2 flex flex-col gap-2">
          {isNew && <Badge variant="success">NEW</Badge>}
          {isBestSeller && <Badge variant="default">Best Seller</Badge>}
        </div>
      </div>
      
      <div className="flex flex-col flex-1 gap-2">
        <div className="text-xs text-[var(--ink-soft)] font-medium uppercase tracking-wider">
          {product.category}
        </div>
        
        <h3 className="text-sm font-bold text-[var(--text-main)] leading-tight line-clamp-2" title={product.name}>
          {product.name}
        </h3>
        
        <div className="mt-auto pt-4 flex items-center justify-between">
          <ProductPrice price={product.price} />
          {product.link && (
            <a href={product.link} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" title="View on BuckedUp">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
