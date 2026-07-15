import React from 'react';
import { cn } from '@/lib/utils';

export interface FilterCheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  count?: number;
}

export function FilterCheckbox({ label, count, className, ...props }: FilterCheckboxProps) {
  return (
    <label className={cn("flex items-start gap-2.5 cursor-pointer group py-1", className)}>
      <div className="relative flex items-center justify-center mt-[3px]">
        <input
          type="checkbox"
          className="peer sr-only"
          {...props}
        />
        {/* Shopee-style checkbox box */}
        <div className="h-3.5 w-3.5 rounded-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-transparent peer-checked:bg-[var(--castleton)] peer-checked:border-[var(--castleton)] transition-colors"></div>
        <svg
          className="absolute h-2.5 w-2.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <span className="text-[13px] text-[var(--text-main)] transition-colors flex-1 select-none leading-relaxed">
        {label}
        {count !== undefined && (
          <span className="text-[var(--ink-soft)] ml-1">
            ({count})
          </span>
        )}
      </span>
    </label>
  );
}
