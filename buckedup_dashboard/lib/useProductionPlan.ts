"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "./supabase/client";
import type { ProductionPlan } from "./types";

interface PlanRow {
  id: string;
  name: string;
  is_active: boolean;
  total_video_target: number;
  start_date: string;
  deadline: string;
  language_targets: Record<string, number>;
  category_targets: Record<string, number>;
  notes: string | null;
}

function toPlan(row: PlanRow): ProductionPlan {
  return {
    id: row.id,
    name: row.name,
    isActive: row.is_active,
    totalVideoTarget: row.total_video_target,
    dailyVideoTarget: 0,
    startDate: row.start_date,
    deadline: row.deadline,
    stageTargets: {},
    languageTargets: row.language_targets ?? {},
    categoryTargets: row.category_targets ?? {},
    notes: row.notes,
  };
}

interface UseProductionPlanState {
  plan: ProductionPlan | null;
  loading: boolean;
}

export function useProductionPlan(): UseProductionPlanState {
  const [plan, setPlan] = useState<ProductionPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const supabaseRef = useRef(createClient());

  const load = useCallback(async () => {
    const { data } = await supabaseRef.current
      .from("production_plans")
      .select("*")
      .eq("is_active", true)
      .maybeSingle();

    setPlan(data ? toPlan(data as PlanRow) : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    const supabase = supabaseRef.current;
    load();

    const channel = supabase
      .channel(`production-plan-changes-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "production_plans" },
        () => load(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  return { plan, loading };
}
