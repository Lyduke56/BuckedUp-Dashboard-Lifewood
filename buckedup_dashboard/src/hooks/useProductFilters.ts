"use client";

import { useMemo, useState } from "react";
import { Product, StatusFilter } from "@/lib/types";
import { productBucket } from "@/lib/productHelpers";

export function useProductFilters(products: Product[]) {
  const [category, setCategory] = useState<string>("all");
  const [subcategory, setSubcategory] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");

  function updateCategory(next: string) {
    setCategory(next);
    setSubcategory("all");
  }

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return products.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (subcategory !== "all" && p.subcategory !== subcategory) return false;
      if (statusFilter !== "all" && productBucket(p) !== statusFilter)
        return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, category, subcategory, statusFilter, searchTerm]);

  return {
    category,
    subcategory,
    statusFilter,
    searchTerm,
    setCategory: updateCategory,
    setSubcategory,
    setStatusFilter,
    setSearchTerm,
    filtered,
  };
}
