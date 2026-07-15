import React from 'react';
import { cn } from '@/lib/utils';
import { Image as ImageIcon } from 'lucide-react';

interface ProductImageProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt: string;
}

export function ProductImage({ className, src, alt, ...props }: ProductImageProps) {
  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden rounded-lg bg-[var(--glass-bg)] border border-[var(--glass-border)] aspect-square",
        className
      )}
      {...props}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
          loading="lazy"
        />
      ) : (
        <div className="flex flex-col items-center justify-center text-[var(--ink-soft)] opacity-50">
          <ImageIcon className="h-10 w-10 mb-2" />
          <span className="text-xs font-medium uppercase tracking-wider text-center px-2">No Image</span>
        </div>
      )}
    </div>
  );
}
