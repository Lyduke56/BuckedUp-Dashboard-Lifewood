"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface HistoryRow {
  status: string;
  entered_at: string;
}

interface StageHistoryLogProps {
  productId: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// On-demand fetch, not realtime — this only loads when a row's detail is
// expanded, same pattern as VideoVersionsPanel. product_status_history is
// populated by supabase/schema.sql's log_status_change() trigger, which
// logs a row on insert and on every stage change (not on any other edit).
export function StageHistoryLog({ productId }: StageHistoryLogProps) {
  const [rows, setRows] = useState<HistoryRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from("product_status_history")
      .select("status, entered_at")
      .eq("product_id", productId)
      .order("entered_at", { ascending: false })
      .then(({ data }) => {
        if (!cancelled && data) setRows(data as HistoryRow[]);
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  if (rows === null) {
    return <div className="issue-empty">Loading history…</div>;
  }
  if (rows.length === 0) {
    return <div className="issue-empty">No stage history yet.</div>;
  }

  return (
    <ul className="stage-history-list">
      {rows.map((row, index) => (
        <li key={`${row.status}-${row.entered_at}`} className="stage-history-item">
          <span className="stage-history-status">{row.status}</span>
          <span className="stage-history-date">{formatDate(row.entered_at)}</span>
          {index === 0 ? <span className="stage-history-current">Current</span> : null}
        </li>
      ))}
    </ul>
  );
}
