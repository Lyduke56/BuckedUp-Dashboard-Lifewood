"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "./supabase/client";
import type {
  DeliverableDecision,
  DeliverableKind,
  DeliverableStage,
  StageDeliverable,
} from "./types";

interface DeliverableRow {
  id: string;
  product_id: string;
  stage: string;
  kind: string;
  file_url: string | null;
  text_content: string | null;
  is_current: boolean;
  submitted_by: string | null;
  submitted_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  decision: string;
  decision_note: string | null;
}

function toDeliverable(row: DeliverableRow): StageDeliverable {
  return {
    id: row.id,
    productId: row.product_id,
    stage: row.stage as DeliverableStage,
    kind: row.kind as DeliverableKind,
    fileUrl: row.file_url,
    textContent: row.text_content,
    isCurrent: row.is_current,
    submittedBy: row.submitted_by,
    submittedAt: row.submitted_at,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    decision: row.decision as DeliverableDecision,
    decisionNote: row.decision_note,
  };
}

function key(productId: string, stage: string): string {
  return `${productId}:${stage}`;
}

interface UseStageDeliverablesState {
  // Current (is_current) deliverable keyed by `${productId}:${stage}`.
  currentByKey: Map<string, StageDeliverable>;
}

// Realtime map of the current deliverable per (product, stage). Consumers
// that know a product's current stage look it up as
// `currentByKey.get(\`${product.id}:${status}\`)`.
export function useStageDeliverables(): UseStageDeliverablesState {
  const [currentByKey, setCurrentByKey] = useState<Map<string, StageDeliverable>>(
    new Map(),
  );
  const supabaseRef = useRef(createClient());

  const load = useCallback(async () => {
    const { data, error } = await supabaseRef.current
      .from("stage_deliverables")
      .select("*")
      .eq("is_current", true);

    if (error || !data) return;

    const next = new Map<string, StageDeliverable>();
    (data as DeliverableRow[]).forEach((row) => {
      next.set(key(row.product_id, row.stage), toDeliverable(row));
    });
    setCurrentByKey(next);
  }, []);

  useEffect(() => {
    const supabase = supabaseRef.current;
    load();

    const channel = supabase
      .channel(`stage-deliverables-changes-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stage_deliverables" },
        () => load(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  return { currentByKey };
}
