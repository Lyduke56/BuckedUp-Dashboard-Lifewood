"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "./supabase/client";
import type { PipelineStatus } from "./types";

interface HistoryRow {
  product_id: string;
  status: string;
  entered_at: string;
}

export interface StageAge {
  status: PipelineStatus | null;
  enteredAt: Date;
  days: number;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

interface UseStageAgeState {
  stageAgeByProductId: Map<string, StageAge>;
}

export function useStageAge(): UseStageAgeState {
  const [stageAgeByProductId, setStageAgeByProductId] = useState<
    Map<string, StageAge>
  >(new Map());
  const supabaseRef = useRef(createClient());

  const load = useCallback(async () => {
    const { data, error } = await supabaseRef.current
      .from("product_status_history")
      .select("product_id, status, entered_at")
      .order("entered_at", { ascending: true });

    if (error || !data) return;

    const latest = new Map<string, HistoryRow>();
    (data as HistoryRow[]).forEach((row) => {
      latest.set(row.product_id, row);
    });

    const now = Date.now();
    const next = new Map<string, StageAge>();
    latest.forEach((row, productId) => {
      const enteredAt = new Date(row.entered_at);
      next.set(productId, {
        status: row.status as PipelineStatus,
        enteredAt,
        days: Math.max(0, (now - enteredAt.getTime()) / MS_PER_DAY),
      });
    });
    setStageAgeByProductId(next);
  }, []);

  useEffect(() => {
    const supabase = supabaseRef.current;
    load();

    const channel = supabase
      .channel(`product-status-history-changes-${Math.random().toString(36).slice(2)}`)
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

  return { stageAgeByProductId };
}
