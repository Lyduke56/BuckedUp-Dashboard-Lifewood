"use client";

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CatalogLayout } from '@/components/templates/CatalogLayout';
import { SearchBar } from '@/components/molecules/SearchBar';
import { FilterSidebar } from '@/components/organisms/FilterSidebar';
import { ProductGrid } from '@/components/organisms/ProductGrid';
import type { ProductData } from '@/components/organisms/ProductCard';

// Fetch the data from the public folder
function useProducts() {
  const [products, setProducts] = useState<ProductData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/data/products.json')
      .then((res) => res.json())
      .then((data) => {
        setProducts(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load products:', err);
        setLoading(false);
      });
  }, []);

  return { products, loading };
}

function CatalogContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { products, loading } = useProducts();

  // Read URL state
  const searchQuery = searchParams.get('q') || '';
  const selectedCategories = searchParams.getAll('category');

  // Derive categories for the sidebar based on the current product list
  const categories = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach((p) => {
      if (p.category) {
        counts[p.category] = (counts[p.category] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [products]);

  // Filter products based on search and selected categories
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch = 
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        product.variants.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = 
        selectedCategories.length === 0 || 
        selectedCategories.includes(product.category);

      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategories]);

  // Handlers for URL state updates
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (newQuery) {
      params.set('q', newQuery);
    } else {
      params.delete('q');
    }
    router.replace(`?${params.toString()}`);
  };

  const handleCategoryChange = (category: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const current = params.getAll('category');
    
    params.delete('category'); // clear them all
    
    // Toggle the selected category
    const updated = current.includes(category)
      ? current.filter((c) => c !== category)
      : [...current, category];
      
    updated.forEach((c) => params.append('category', c));
    router.replace(`?${params.toString()}`);
  };

  const header = (
    <div className="panel p-4 flex flex-col sm:flex-row gap-4 items-center justify-between shadow-lg backdrop-blur-xl bg-[var(--header-bg)] rounded-2xl border border-[var(--header-border)]">
      <div className="flex-1 w-full max-w-md">
        <SearchBar 
          value={searchQuery} 
          onChange={handleSearch} 
          className="bg-[var(--glass-bg)] border-[var(--glass-border)]"
        />
      </div>
      <div className="text-sm font-medium text-[var(--ink-soft)] whitespace-nowrap">
        Showing {filteredProducts.length} products
      </div>
    </div>
  );

  const sidebar = (
    <FilterSidebar
      categories={categories}
      selectedCategories={selectedCategories}
      onCategoryChange={handleCategoryChange}
    />
  );

  return (
    <CatalogLayout
      sidebar={sidebar}
      header={header}
      content={
        loading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--castleton)]"></div>
          </div>
        ) : (
          <ProductGrid products={filteredProducts} />
        )
      }
    />
  );
}

export function CatalogView() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading catalog...</div>}>
      <CatalogContent />
    </Suspense>
  );
}
