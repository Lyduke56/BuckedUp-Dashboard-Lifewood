import React from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'outline';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--castleton)] focus:ring-offset-2",
        {
          'border-transparent bg-[var(--pill-active-bg)] text-[var(--castleton)]': variant === 'default',
          'border-transparent bg-emerald-500/15 text-emerald-500': variant === 'success',
          'border-transparent bg-amber-500/15 text-amber-500': variant === 'warning',
          'border-transparent bg-rose-500/15 text-rose-500': variant === 'destructive',
          'text-[var(--text-main)] border-[var(--glass-border)]': variant === 'outline',
        },
        className
      )}
      {...props}
    />
  );
}
