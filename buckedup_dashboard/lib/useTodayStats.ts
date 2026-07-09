"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "./supabase/client";

interface ProductRef {
  category: string;
  language: string;
}

interface HistoryRow {
  status: string;
  entered_at: string;
  products: ProductRef | ProductRef[] | null;
}

export interface TodayStats {
  publishedToday: number;
  byStage: Record<string, number>;
  publishedByCategory: Record<string, number>;
  publishedByLanguage: Record<string, number>;
}

const EMPTY_STATS: TodayStats = {
  publishedToday: 0,
  byStage: {},
  publishedByCategory: {},
  publishedByLanguage: {},
};

function startOfTodayIso(): string {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

// "Today" = videos that moved *into* a given stage today, read straight off
// product_status_history (see log_status_change() in supabase/schema.sql) —
// the same source useStageAge.ts reads, just aggregated by day instead of
// by product. Category/language "today" figures only make sense at the
// terminal stage (Published), since a category/language isn't a stage.
export function useTodayStats(): TodayStats {
  const [stats, setStats] = useState<TodayStats>(EMPTY_STATS);
  const supabaseRef = useRef(createClient());

  const load = useCallback(async () => {
    const { data, error } = await supabaseRef.current
      .from("product_status_history")
      .select("status, entered_at, products(category, language)")
      .gte("entered_at", startOfTodayIso());

    if (error || !data) return;

    const byStage: Record<string, number> = {};
    const publishedByCategory: Record<string, number> = {};
    const publishedByLanguage: Record<string, number> = {};
    let publishedToday = 0;

    (data as unknown as HistoryRow[]).forEach((row) => {
      byStage[row.status] = (byStage[row.status] ?? 0) + 1;
      if (row.status === "Published") {
        publishedToday += 1;
        const product = Array.isArray(row.products) ? row.products[0] : row.products;
        if (product) {
          publishedByCategory[product.category] = (publishedByCategory[product.category] ?? 0) + 1;
          publishedByLanguage[product.language] = (publishedByLanguage[product.language] ?? 0) + 1;
        }
      }
    });

    setStats({ publishedToday, byStage, publishedByCategory, publishedByLanguage });
  }, []);

  useEffect(() => {
    const supabase = supabaseRef.current;
    load();

    const channel = supabase
      .channel(`today-stats-changes-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "product_status_history" },
        () => load(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  return stats;
}
