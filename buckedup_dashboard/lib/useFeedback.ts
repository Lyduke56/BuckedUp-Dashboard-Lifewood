"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "./supabase/client";
import type { Feedback, FeedbackReaction } from "./types";

interface FeedbackRow {
  id: string;
  product_id: string;
  user_id: string;
  content: string;
  reaction?: FeedbackReaction | null;
  created_at: string;
  profiles: { email: string } | { email: string }[] | null;
}

function toFeedback(row: FeedbackRow): Feedback {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return {
    id: row.id,
    productId: row.product_id,
    userId: row.user_id,
    userEmail: profile?.email ?? "Unknown User",
    content: row.content,
    reaction: row.reaction ?? null,
    createdAt: row.created_at,
  };
}

interface UseFeedbackState {
  feedbackList: Feedback[];
  loading: boolean;
  addFeedback: (productId: string, content: string, reaction?: FeedbackReaction | null) => Promise<void>;
  deleteFeedback: (id: string) => Promise<void>;
}

export function useFeedback(productId?: string): UseFeedbackState {
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const supabaseRef = useRef(createClient());

  const load = useCallback(async () => {
    if (!productId) {
      setFeedbackList([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabaseRef.current
      .from("feedback")
      .select("id, product_id, user_id, content, reaction, created_at, profiles(email)")
      .eq("product_id", productId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setFeedbackList((data as unknown as FeedbackRow[]).map(toFeedback));
    }
    setLoading(false);
  }, [productId]);

  useEffect(() => {
    const supabase = supabaseRef.current;
    load();

    if (!productId) return;

    const channel = supabase
      .channel(`feedback-changes-${productId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "feedback", filter: `product_id=eq.${productId}` },
        () => load(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, productId]);

  const addFeedback = useCallback(
    async (pid: string, content: string, reaction?: FeedbackReaction | null) => {
      const supabase = supabaseRef.current;
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return;

      const { error: insertError } = await supabase.from("feedback").insert({
        product_id: pid,
        user_id: userData.user.id,
        content,
        reaction: reaction || null,
      });

      if (!insertError) await load();
    },
    [load],
  );

  const deleteFeedback = useCallback(
    async (id: string) => {
      const supabase = supabaseRef.current;
      const { error: deleteError } = await supabase.from("feedback").delete().eq("id", id);
      if (!deleteError) await load();
    },
    [load],
  );

  return { feedbackList, loading, addFeedback, deleteFeedback };
}

export function useAllFeedbackSummary() {
  const [feedbackProductIds, setFeedbackProductIds] = useState<Set<string>>(new Set());
  const [reactionsByProduct, setReactionsByProduct] = useState<Map<string, FeedbackReaction[]>>(new Map());
  const supabaseRef = useRef(createClient());

  const fetchSummary = useCallback(async () => {
    const { data } = await supabaseRef.current
      .from("feedback")
      .select("product_id, reaction");

    if (data) {
      const ids = new Set<string>();
      const reactMap = new Map<string, FeedbackReaction[]>();
      data.forEach((row: { product_id: string; reaction?: FeedbackReaction | null }) => {
        ids.add(row.product_id);
        if (row.reaction) {
          const list = reactMap.get(row.product_id) || [];
          list.push(row.reaction);
          reactMap.set(row.product_id, list);
        }
      });
      setFeedbackProductIds(ids);
      setReactionsByProduct(reactMap);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
    const supabase = supabaseRef.current;
    const channel = supabase
      .channel("all-feedback-summary")
      .on("postgres_changes", { event: "*", schema: "public", table: "feedback" }, () => fetchSummary())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSummary]);

  return { feedbackProductIds, reactionsByProduct };
}

