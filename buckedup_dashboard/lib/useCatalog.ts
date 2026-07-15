"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "./supabase/client";
import type { CatalogProduct } from "./types";

// ---------------------------------------------------------------------------
// DB row shape — snake_case as Supabase returns it
// ---------------------------------------------------------------------------
interface CatalogRow {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  variants: string[];          // jsonb array, already parsed by supabase-js
  variant_count: number;
  price: string | null;
  flag_status: string | null;
  product_url: string | null;
  thumbnail_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function toCatalogProduct(row: CatalogRow): CatalogProduct {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    subcategory: row.subcategory,
    variants: Array.isArray(row.variants) ? row.variants : [],
    variantCount: row.variant_count ?? 0,
    price: row.price,
    flagStatus: row.flag_status,
    productUrl: row.product_url,
    thumbnailUrl: row.thumbnail_url,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface UseCatalogState {
  catalog: CatalogProduct[];
  loading: boolean;
  error: string | null;
}

/**
 * Fetches all rows from the `catalog_products` table and keeps them live
 * via a Supabase Realtime subscription. Follows the exact pattern used by
 * useVideoRequests so the Dashboard can treat both data sets uniformly.
 *
 * Only active products are returned by default. Pass `includeInactive: true`
 * to include discontinued items (useful for admin audit views).
 */
export function useCatalog(includeInactive = false): UseCatalogState {
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabaseRef = useRef(createClient());

  const load = useCallback(async () => {
    let query = supabaseRef.current
      .from("catalog_products")
      .select("*")
      .order("category", { ascending: true })
      .order("subcategory", { ascending: true })
      .order("name", { ascending: true });

    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    const { data, error: fetchError } = await query;

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setCatalog((data as CatalogRow[]).map(toCatalogProduct));
      setError(null);
    }
    setLoading(false);
  }, [includeInactive]);

  useEffect(() => {
    const supabase = supabaseRef.current;
    load();

    const channel = supabase
      .channel(`catalog-changes-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "catalog_products" },
        () => load(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  return { catalog, loading, error };
}
