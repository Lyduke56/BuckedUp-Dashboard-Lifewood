import type { UIMessage } from "ai";
import type { createClient } from "@/lib/supabase/client";

// This persistence is entirely client-driven (from BuckyWidget.tsx), same
// as the localStorage version it replaces — there's no server-route
// reason to touch chat history, it's purely a "save my own conversation"
// concern. Hence the browser client type, not the session-scoped server
// client type used elsewhere in lib/bucky/.
export type SupabaseBrowserClient = ReturnType<typeof createClient>;

type MessageRow = {
  id: string;
  role: "user" | "assistant" | "system";
  parts: unknown;
  metadata: unknown;
};

export async function loadChatHistory(
  supabase: SupabaseBrowserClient,
  userId: string,
): Promise<UIMessage[]> {
  const { data, error } = await supabase
    .from("bucky_messages")
    .select("id, role, parts, metadata")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("bucky-chat-history load failed:", error);
    return [];
  }
  return ((data ?? []) as MessageRow[]).map((row) => ({
    id: row.id,
    role: row.role,
    parts: row.parts,
    metadata: row.metadata ?? undefined,
  })) as UIMessage[];
}

// Upserts every message currently in the array, not just the ones that
// changed since the last save — a deliberate simplification. Conversations
// in this app are short, so a batch upsert of the whole thing is cheap;
// writing only the changed message is a possible future optimization, not
// a necessary one at this scale.
export async function saveChatHistory(
  supabase: SupabaseBrowserClient,
  userId: string,
  messages: UIMessage[],
): Promise<void> {
  if (messages.length === 0) return;
  const rows = messages.map((m) => ({
    id: m.id,
    user_id: userId,
    role: m.role,
    parts: m.parts,
    metadata: m.metadata ?? null,
  }));
  const { error } = await supabase.from("bucky_messages").upsert(rows, { onConflict: "id,user_id" });
  if (error) console.error("bucky-chat-history save failed:", error);
}

export async function clearChatHistory(supabase: SupabaseBrowserClient, userId: string): Promise<void> {
  const { error } = await supabase.from("bucky_messages").delete().eq("user_id", userId);
  if (error) console.error("bucky-chat-history clear failed:", error);
}
