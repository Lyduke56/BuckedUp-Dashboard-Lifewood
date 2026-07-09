"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "./supabase/client";
import { useAuth } from "./useAuth";

interface NotificationRow {
  id: string;
  type: string;
  message: string;
  product_id: string | null;
  read: boolean;
  created_at: string;
  products: { name: string } | { name: string }[] | null;
}

export interface AppNotification {
  id: string;
  type: string;
  message: string;
  productId: string | null;
  productName: string | null;
  read: boolean;
  createdAt: string;
}

function toNotification(row: NotificationRow): AppNotification {
  const product = Array.isArray(row.products) ? row.products[0] : row.products;
  return {
    id: row.id,
    type: row.type,
    message: row.message,
    productId: row.product_id,
    productName: product?.name ?? null,
    read: row.read,
    createdAt: row.created_at,
  };
}

interface UseNotificationsState {
  notifications: AppNotification[];
  unreadCount: number;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

export function useNotifications(): UseNotificationsState {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const supabaseRef = useRef(createClient());

  // Reset during render (React's sanctioned pattern for syncing local
  // state from a prop/external value) rather than in the effect below.
  const [lastUserId, setLastUserId] = useState<string | undefined>(user?.id);
  if (user?.id !== lastUserId) {
    setLastUserId(user?.id);
    if (!user) setNotifications([]);
  }

  const load = useCallback(async (userId: string) => {
    const { data, error } = await supabaseRef.current
      .from("notifications")
      .select("id, type, message, product_id, read, created_at, products(name)")
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error && data) {
      setNotifications((data as unknown as NotificationRow[]).map(toNotification));
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    const supabase = supabaseRef.current;
    load(user.id);

    const channel = supabase
      .channel(`notifications-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${user.id}`,
        },
        () => load(user.id),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, load]);

  const markRead = useCallback(async (id: string) => {
    await supabaseRef.current.from("notifications").update({ read: true }).eq("id", id);
  }, []);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    await supabaseRef.current
      .from("notifications")
      .update({ read: true })
      .eq("recipient_id", user.id)
      .eq("read", false);
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount, markRead, markAllRead };
}
