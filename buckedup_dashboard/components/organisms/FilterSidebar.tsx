import React from 'react';
import { FilterCheckbox } from '@/components/molecules/FilterCheckbox';
import { Filter } from 'lucide-react';

interface FilterSidebarProps {
  categories: { name: string; count: number }[];
  selectedCategories: string[];
  onCategoryChange: (category: string) => void;
  className?: string;
}

export function FilterSidebar({ categories, selectedCategories, onCategoryChange, className = '' }: FilterSidebarProps) {
  return (
    <div className={`flex flex-col ${className}`}>
      <div className="panel p-0 overflow-hidden">
        {/* Shopee-style Main Header */}
        <div className="px-5 py-4 border-b border-[var(--glass-border)] flex items-center gap-2">
          <Filter className="h-4 w-4 text-[var(--text-main)] font-bold" strokeWidth={2.5} />
          <h2 className="text-[15px] font-bold text-[var(--text-main)] uppercase tracking-wide">
            Search Filter
          </h2>
        </div>

        {/* Categories Section */}
        <div className="px-5 py-5">
          <h3 className="text-[14px] font-semibold text-[var(--text-main)] mb-3">
            By Category
          </h3>
          <div className="flex flex-col gap-2.5 max-h-[400px] overflow-y-auto custom-scrollbar">
            {categories.map((cat) => (
              <FilterCheckbox
                key={cat.name}
                label={cat.name}
                count={cat.count}
                checked={selectedCategories.includes(cat.name)}
                onChange={() => onCategoryChange(cat.name)}
              />
            ))}
            {categories.length === 0 && (
              <div className="text-[13px] text-[var(--ink-soft)] py-2">No categories available.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
