"use client";

import { useEffect, useState } from "react";
import type { PipelineStatus, Product } from "./types";

const POLL_INTERVAL_MS = 20_000;

const KNOWN_STATUSES: PipelineStatus[] = [
  "Not Started",
  "Scripting",
  "Filming",
  "Editing",
  "In Review",
  "Scheduled",
  "Published",
];

interface SheetRow {
  Rank?: number | string;
  Product?: string;
  Category?: string;
  Subcategory?: string;
  "Product URL"?: string;
  "Content Angle"?: string;
  Langauge?: string;
  "Content Type"?: string;
  Owner?: string;
  Stages?: string;
  Status?: string;
  "Video URL"?: string;
  "Publish Date"?: string;
}

function isPipelineStatus(value: unknown): value is PipelineStatus {
  return KNOWN_STATUSES.includes(value as PipelineStatus);
}

function readField(row: SheetRow, ...keys: string[]): string | null {
  const record = row as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return null;
}

function toProduct(row: SheetRow): Product | null {
  const name = row.Product?.toString().trim();
  const rank = Number(row.Rank);
  if (!name || !Number.isFinite(rank)) return null;

  // "Stages" holds the granular pipeline stage (what used to live in
  // "Status" before the Sheet was restructured); "Status" now holds a
  // separate, coarser review/approval state.
  const stageValue = readField(row, "Stages", "Status");
  const status = isPipelineStatus(stageValue) ? stageValue : "Not Started";
  const reviewStatus = readField(row, "Status");
  const videoUrl = readField(row, "Video URL");
  const productUrl = readField(row, "Product URL");
  const type = row["Content Type"]?.toString().trim() ?? "";
  const language = readField(row, "Langauge", "Language") ?? "English";
  const contentAngle = readField(row, "Content Angle") ?? "";
  const owner = readField(row, "Owner");
  const publishDate = readField(row, "Publish Date");

  return {
    rank,
    name,
    category: row.Category?.toString().trim() || "Uncategorized",
    subcategory: row.Subcategory?.toString().trim() || "Uncategorized",
    type,
    language,
    productUrl,
    contentAngle,
    owner,
    publishDate,
    reviewStatus,
    items: [
      {
        name: type ? `${name} — ${type}` : name,
        status,
        videoUrl,
        productUrl,
      },
    ],
  };
}

interface VideoRequestsState {
  products: Product[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => void;
}

export function useVideoRequests(): VideoRequestsState {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load(showLoading: boolean) {
      if (showLoading) setLoading(true);
      try {
        const res = await fetch("/api/videos", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || json.error) {
          throw new Error(json.error ?? `HTTP ${res.status}`);
        }
        const rows = (json.data ?? []) as SheetRow[];
        const mapped = rows
          .map(toProduct)
          .filter((product): product is Product => product !== null)
          .sort((a, b) => a.rank - b.rank);
        if (cancelled) return;
        setProducts(mapped);
        setError(null);
        setLastUpdated(new Date());
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Failed to load video requests",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load(true);
    const interval = setInterval(() => load(false), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [refreshToken]);

  const refresh = () => setRefreshToken((token) => token + 1);

  return { products, loading, error, lastUpdated, refresh };
}
