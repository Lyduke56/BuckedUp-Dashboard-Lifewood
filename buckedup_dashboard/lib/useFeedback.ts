"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "./supabase/client";
import type { Feedback } from "./types";

interface FeedbackRow {
  id: string;
  product_id: string;
  user_id: string;
  content: string;
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
    createdAt: row.created_at,
  };
}

interface UseFeedbackState {
  feedbackList: Feedback[];
  loading: boolean;
  addFeedback: (productId: string, content: string) => Promise<void>;
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
      .select("id, product_id, user_id, content, created_at, profiles(email)")
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
    async (pid: string, content: string) => {
      const supabase = supabaseRef.current;
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return;

      const { error: insertError } = await supabase.from("feedback").insert({
        product_id: pid,
        user_id: userData.user.id,
        content,
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
