import React from 'react';
import { Input, InputProps } from '@/components/atoms/Input';
import { Search } from 'lucide-react';

export type SearchBarProps = React.InputHTMLAttributes<HTMLInputElement>;

export function SearchBar({ className, ...props }: SearchBarProps) {
  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--ink-soft)]" />
      <Input
        type="search"
        className="pl-10 rounded-full"
        placeholder="Search products..."
        {...props}
      />
    </div>
  );
}
