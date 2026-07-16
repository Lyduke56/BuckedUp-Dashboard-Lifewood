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
  target?: number;
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
export function useDailyProgress(
  daysOrStartDate?: number | string,
  dailyAccumulativeTargets?: Record<string, number> | null,
): DailyProgressPoint[] {
  const [points, setPoints] = useState<DailyProgressPoint[]>([]);
  const supabaseRef = useRef(createClient());

  const rangeStartIso = useMemo(() => {
    let start: Date;
    if (typeof daysOrStartDate === "string") {
      const parts = daysOrStartDate.split("-");
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        start = new Date(year, month, day, 0, 0, 0, 0);
      } else {
        start = new Date();
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() - 13);
      }
    } else {
      const days = typeof daysOrStartDate === "number" ? daysOrStartDate : 14;
      start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - (days - 1));
    }
    return start.toISOString();
  }, [daysOrStartDate]);

  const load = useCallback(async () => {
    const [historyRes, targetRes] = await Promise.all([
      supabaseRef.current
        .from("product_status_history")
        .select("status, entered_at, products(category, subcategory)")
        .gte("entered_at", rangeStartIso),
      supabaseRef.current
        .from("daily_target_history")
        .select("date, target")
        .gte("date", rangeStartIso.split("T")[0])
    ]);

    if (historyRes.error || targetRes.error) return;
    const historyData = historyRes.data || [];
    const targetData = targetRes.data || [];

    const targetMap = new Map<string, number>();
    targetData.forEach((t: { date: string; target: number }) => {
      targetMap.set(t.date, t.target);
    });

    // Seed one bucket per day in the window so gaps render as zeros.
    const buckets = new Map<string, DailyProgressPoint>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let start: Date;
    if (typeof daysOrStartDate === "string") {
      const parts = daysOrStartDate.split("-");
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        start = new Date(year, month, day, 0, 0, 0, 0);
      } else {
        start = new Date();
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() - 13);
      }
    } else {
      const days = typeof daysOrStartDate === "number" ? daysOrStartDate : 14;
      start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - (days - 1));
    }

    const current = new Date(start.getTime());
    if (current > today) {
      current.setTime(today.getTime());
    }

    while (current <= today) {
      const key = localDateKey(current);
      buckets.set(key, {
        date: key,
        label: current.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        published: 0,
        byStage: {},
        byCategory: {},
        target: (dailyAccumulativeTargets && dailyAccumulativeTargets[key] !== undefined)
          ? dailyAccumulativeTargets[key]
          : targetMap.get(key),
      });
      current.setDate(current.getDate() + 1);
    }

    (historyData as unknown as HistoryRow[]).forEach((row) => {
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
  }, [daysOrStartDate, rangeStartIso, dailyAccumulativeTargets]);

  useEffect(() => {
    const supabase = supabaseRef.current;
    load();

    const channel = supabase
      .channel(`daily-progress-realtime-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "product_status_history" },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "daily_target_history" },
        () => load(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  return points;
}
