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
        <div className="flex flex-col items-center justify-center w-full h-full p-4 opacity-20 grayscale transition-all duration-300 hover:opacity-40 hover:grayscale-0">
          <img 
            src="/buckedup.svg" 
            alt="BuckedUp Logo Placeholder" 
            className="w-3/4 h-auto max-w-[120px] object-contain drop-shadow-xl" 
          />
        </div>
      )}
    </div>
  );
}
