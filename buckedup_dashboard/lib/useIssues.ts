"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "./supabase/client";
import type { Issue, IssueSeverity, IssueStatus } from "./types";

interface IssueRow {
  id: string;
  description: string;
  severity: IssueSeverity;
  status: IssueStatus;
  created_at: string;
  product_id: string;
  products: { rank: number } | { rank: number }[] | null;
}

function toIssue(row: IssueRow): Issue {
  const product = Array.isArray(row.products) ? row.products[0] : row.products;
  return {
    id: row.id,
    rank: product?.rank ?? 0,
    productId: row.product_id,
    description: row.description,
    severity: row.severity,
    status: row.status,
    createdAt: row.created_at,
  };
}

interface UseIssuesState {
  issues: Issue[];
  loading: boolean;
  reportIssue: (
    rank: number,
    description: string,
    severity: IssueSeverity,
  ) => Promise<void>;
  resolveIssue: (id: string, productId?: string) => Promise<void>;
}

export function useIssues(): UseIssuesState {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const supabaseRef = useRef(createClient());

  const load = useCallback(async () => {
    const { data, error } = await supabaseRef.current
      .from("issues")
      .select("id, description, severity, status, created_at, product_id, products(rank)")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setIssues((data as unknown as IssueRow[]).map(toIssue));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const supabase = supabaseRef.current;
    load();

    const channel = supabase
      .channel(`issues-changes-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "issues" },
        () => load(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const reportIssue = useCallback(
    async (rank: number, description: string, severity: IssueSeverity) => {
      const supabase = supabaseRef.current;
      const { data: product, error: lookupError } = await supabase
        .from("products")
        .select("id")
        .eq("rank", rank)
        .single();

      if (lookupError || !product) return;

      const { error: insertError } = await supabase.from("issues").insert({
        product_id: product.id,
        description,
        severity,
      });

      if (!insertError) await load();
    },
    [load],
  );

  const resolveIssue = useCallback(
    async (id: string, productId?: string) => {
      const supabase = supabaseRef.current;
      const { error: updateError } = await supabase
        .from("issues")
        .update({ status: "resolved" })
        .eq("id", id);

      if (!updateError) {
        if (productId) {
          // If the product was Rejected, reset it back to an active state
          await supabase
            .from("products")
            .update({ review_status: null, rejection_reason: null })
            .eq("id", productId)
            .eq("review_status", "Rejected");
        }
        await load();
      }
    },
    [load],
  );

  return { issues, loading, reportIssue, resolveIssue };
}
