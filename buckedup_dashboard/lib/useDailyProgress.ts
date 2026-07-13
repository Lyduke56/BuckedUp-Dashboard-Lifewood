"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "./supabase/client";

interface ProductRef {
  category: string;
  subcategory: string;
}

interface HistoryRow {
  status: string;
  entered_at: string;
  products: ProductRef | ProductRef[] | null;
}

export interface DailyProgressPoint {
  date: string; // yyyy-mm-dd (local)
  label: string; // e.g. "Jul 8"
  published: number; // videos that reached Published that day
  byStage: Record<string, number>; // count entering each stage that day
  byCategory: Record<string, number>; // published-by-category that day
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// A live, per-day rollup of pipeline flow over the last `days` days,
// derived client-side from product_status_history — the same source and
// convention as useTodayStats/useStageAge, just grouped by calendar day
// over a range. `published` is the overall "actual" series; byStage /
// byCategory back the dimension breakdowns. No new schema/snapshot table:
// each row in product_status_history is a discrete "entered stage X at
// time T" event, which is exactly the flow metric this chart wants.
export function useDailyProgress(days = 14): DailyProgressPoint[] {
  const [points, setPoints] = useState<DailyProgressPoint[]>([]);
  const supabaseRef = useRef(createClient());

  const rangeStartIso = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));
    return start.toISOString();
  }, [days]);

  const load = useCallback(async () => {
    const { data, error } = await supabaseRef.current
      .from("product_status_history")
      .select("status, entered_at, products(category, subcategory)")
      .gte("entered_at", rangeStartIso);

    if (error || !data) return;

    // Seed one bucket per day in the window so gaps render as zeros.
    const buckets = new Map<string, DailyProgressPoint>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today.getTime() - i * MS_PER_DAY);
      const key = localDateKey(d);
      buckets.set(key, {
        date: key,
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        published: 0,
        byStage: {},
        byCategory: {},
      });
    }

    (data as unknown as HistoryRow[]).forEach((row) => {
      const key = localDateKey(new Date(row.entered_at));
      const bucket = buckets.get(key);
      if (!bucket) return;
      bucket.byStage[row.status] = (bucket.byStage[row.status] ?? 0) + 1;
      if (row.status === "Published") {
        bucket.published += 1;
        const product = Array.isArray(row.products) ? row.products[0] : row.products;
        if (product) {
          bucket.byCategory[product.category] =
            (bucket.byCategory[product.category] ?? 0) + 1;
        }
      }
    });

    setPoints(Array.from(buckets.values()));
  }, [days, rangeStartIso]);

  useEffect(() => {
    const supabase = supabaseRef.current;
    load();

    const channel = supabase
      .channel(`daily-progress-changes-${Math.random().toString(36).slice(2)}`)
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

  return points;
}
