"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "./supabase/client";
import type { PipelineStatus, Product } from "./types";

const KNOWN_STATUSES: PipelineStatus[] = [
  "Not Started",
  "Storyboarding",
  "Scripting",
  "Prompting",
  "Editing",
  "In Review",
  "Published",
];

function isPipelineStatus(value: unknown): value is PipelineStatus {
  return KNOWN_STATUSES.includes(value as PipelineStatus);
}

interface ProductRow {
  id: string;
  rank: number;
  name: string;
  category: string;
  subcategory: string;
  content_type: string | null;
  language: string;
  product_url: string | null;
  content_angle: string | null;
  owner: string | null;
  owner_id: string | null;
  publish_date: string | null;
  review_status: string | null;
  rejection_reason: string | null;
  status: string;
  delivery_type: string | null;
  video_url: string | null;
}

function toProduct(row: ProductRow): Product {
  const status = isPipelineStatus(row.status) ? row.status : "Not Started";
  const type = row.content_type ?? "";

  return {
    id: row.id,
    rank: row.rank,
    name: row.name,
    category: row.category || "Uncategorized",
    subcategory: row.subcategory || "Uncategorized",
    type,
    language: row.language || "English",
    productUrl: row.product_url,
    contentAngle: row.content_angle ?? "",
    owner: row.owner,
    ownerId: row.owner_id,
    publishDate: row.publish_date,
    reviewStatus: row.review_status,
    rejectionReason: row.rejection_reason,
    deliveryType: row.delivery_type === "link" ? "link" : "pipeline",
    items: [
      {
        name: type ? `${row.name} — ${type}` : row.name,
        status,
        videoUrl: row.video_url,
        productUrl: row.product_url,
      },
    ],
  };
}

interface VideoRequestsState {
  products: Product[];
  loading: boolean;
  error: string | null;
}

export function useVideoRequests(): VideoRequestsState {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabaseRef = useRef(createClient());

  const load = useCallback(async () => {
    const { data, error: fetchError } = await supabaseRef.current
      .from("products")
      .select("*")
      .order("rank", { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setProducts((data as ProductRow[]).map(toProduct));
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const supabase = supabaseRef.current;
    load();

    const channel = supabase
      .channel(`products-changes-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        () => load(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  return { products, loading, error };
}
