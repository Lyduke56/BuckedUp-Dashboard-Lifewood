import React from 'react';
import { cn } from '@/lib/utils';

export interface ProductPriceProps extends React.HTMLAttributes<HTMLDivElement> {
  price: string;
}

export function ProductPrice({ price, className, ...props }: ProductPriceProps) {
  // Extract number from price string (e.g. "$49.99 (Normal $69.99)" -> "$49.99")
  const primaryPrice = price.split(' ')[0] || price;
  const originalPriceMatch = price.match(/\(Normal (\$\d+\.\d+)\)/);
  const originalPrice = originalPriceMatch ? originalPriceMatch[1] : null;

  return (
    <div className={cn("flex items-center gap-2", className)} {...props}>
      <span className="text-lg font-bold text-[var(--text-main)]">{primaryPrice}</span>
      {originalPrice && (
        <span className="text-sm text-[var(--ink-soft)] line-through">
          {originalPrice}
        </span>
      )}
    </div>
  );
}
