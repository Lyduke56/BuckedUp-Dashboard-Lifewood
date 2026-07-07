"use client";

import { CATEGORY_TREE } from "@/lib/categoryTree";
import { Product, StatusFilter } from "@/lib/types";
import { categoryCount, subcategoryCount } from "@/lib/productHelpers";
import { Pill } from "@/components/ui/Pill";

interface FilterToolbarProps {
  products: Product[];
  category: string;
  subcategory: string;
  statusFilter: StatusFilter;
  searchTerm: string;
  onCategoryChange: (value: string) => void;
  onSubcategoryChange: (value: string) => void;
  onStatusFilterChange: (value: StatusFilter) => void;
  onSearchTermChange: (value: string) => void;
}

const STATUS_PILLS: { label: string; value: StatusFilter }[] = [
  { label: "All statuses", value: "all" },
  { label: "Not started", value: "not-started" },
  { label: "In progress", value: "in-progress" },
  { label: "Published", value: "published" },
];

export function FilterToolbar({
  products,
  category,
  subcategory,
  statusFilter,
  searchTerm,
  onCategoryChange,
  onSubcategoryChange,
  onStatusFilterChange,
  onSearchTermChange,
}: FilterToolbarProps) {
  const subcategories = category !== "all" ? CATEGORY_TREE[category] ?? [] : [];

  return (
    <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <select
          value={category}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="rounded-[9px] border border-line bg-white px-3 py-2 text-[12.5px] font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-castleton"
        >
          <option value="all">All categories ({products.length})</option>
          {Object.keys(CATEGORY_TREE).map((cat) => (
            <option key={cat} value={cat}>
              {cat} ({categoryCount(products, cat)})
            </option>
          ))}
        </select>

        <select
          value={subcategory}
          disabled={category === "all"}
          onChange={(e) => onSubcategoryChange(e.target.value)}
          className="rounded-[9px] border border-line bg-white px-3 py-2 text-[12.5px] font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-castleton disabled:opacity-50"
        >
          <option value="all">
            {category === "all"
              ? "All subcategories"
              : `All subcategories (${categoryCount(products, category)})`}
          </option>
          {subcategories.map((sub) => (
            <option key={sub} value={sub}>
              {sub} ({subcategoryCount(products, category, sub)})
            </option>
          ))}
        </select>

        <div className="flex flex-wrap gap-[7px]">
          {STATUS_PILLS.map((pill) => (
            <Pill
              key={pill.value}
              label={pill.label}
              active={statusFilter === pill.value}
              onClick={() => onStatusFilterChange(pill.value)}
            />
          ))}
        </div>
      </div>

      <input
        type="text"
        value={searchTerm}
        onChange={(e) => onSearchTermChange(e.target.value)}
        placeholder="Search product…"
        className="min-w-[200px] rounded-[9px] border border-line px-3 py-2 text-[12.5px] font-semibold focus:outline-none focus:ring-2 focus:ring-castleton"
      />
    </div>
  );
}
