"use client";

import { useDashboard } from "@/contexts/DashboardContext";
import { useProductFilters } from "@/hooks/useProductFilters";
import { FilterToolbar } from "@/components/library/FilterToolbar";
import { FolderGrid } from "@/components/library/FolderGrid";

export default function LibraryPage() {
  const { products } = useDashboard();
  const {
    category,
    subcategory,
    statusFilter,
    searchTerm,
    setCategory,
    setSubcategory,
    setStatusFilter,
    setSearchTerm,
    filtered,
  } = useProductFilters(products);

  return (
    <div className="animate-fadeUp">
      <div className="mb-[3px] text-base font-extrabold text-serpent">
        Video library
      </div>
      <p className="mb-[18px] text-[12.5px] font-semibold text-ink-soft">
        Priority-ranked shot list — grows automatically as new products are
        requested, across any category in the catalog.
      </p>

      <FilterToolbar
        products={products}
        category={category}
        subcategory={subcategory}
        statusFilter={statusFilter}
        searchTerm={searchTerm}
        onCategoryChange={setCategory}
        onSubcategoryChange={setSubcategory}
        onStatusFilterChange={setStatusFilter}
        onSearchTermChange={setSearchTerm}
      />

      <FolderGrid products={filtered} />
    </div>
  );
}
