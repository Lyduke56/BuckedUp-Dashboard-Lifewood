"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "./supabase/client";
import { useProfiles } from "./useProfiles";
import type { UserRole } from "./types";

export interface BuckyConversationUser {
  userId: string;
  email: string;
  role: UserRole;
  messageCount: number;
  lastMessageAt: string;
}

interface UseBuckyConversationUsersState {
  conversationUsers: BuckyConversationUser[];
  loading: boolean;
}

interface MessageRow {
  user_id: string;
  created_at: string;
}

// Admin-only list of who has ever talked to Bucky, aggregated client-side
// from bucky_messages -- deliberately fetches only (user_id, created_at),
// never `parts`, so this list stays light regardless of how long
// individual transcripts get. A selected user's full transcript is loaded
// separately, on demand, via loadChatHistory() in BuckyTranscriptModal.
// RLS ("Admin read" on bucky_messages) is the real gate; this hook has no
// role check of its own, matching this codebase's "UI hides, DB blocks"
// convention -- a non-admin session simply gets zero rows back.
//
// One-shot load, not realtime-subscribed like most hooks in this app:
// bucky_messages isn't in the supabase_realtime publication, and this is a
// low-frequency admin-review screen, not a live monitoring dashboard, so
// that's a deliberate simplification rather than an oversight.
export function useBuckyConversationUsers(): UseBuckyConversationUsersState {
  const { profiles } = useProfiles();
  const [rows, setRows] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const supabaseRef = useRef(createClient());

  const load = useCallback(async () => {
    const { data, error } = await supabaseRef.current
      .from("bucky_messages")
      .select("user_id, created_at");
    if (!error && data) setRows(data as MessageRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const byUser = new Map<string, { count: number; last: string }>();
  for (const row of rows) {
    const existing = byUser.get(row.user_id);
    if (!existing) {
      byUser.set(row.user_id, { count: 1, last: row.created_at });
    } else {
      existing.count += 1;
      if (row.created_at > existing.last) existing.last = row.created_at;
    }
  }

  const conversationUsers: BuckyConversationUser[] = Array.from(byUser.entries())
    .map(([userId, agg]) => {
      const profile = profileById.get(userId);
      return {
        userId,
        email: profile?.email ?? "(unknown user)",
        role: profile?.role ?? ("operator" as UserRole),
        messageCount: agg.count,
        lastMessageAt: agg.last,
      };
    })
    .sort((a, b) => (a.lastMessageAt < b.lastMessageAt ? 1 : -1));

  return { conversationUsers, loading };
}
