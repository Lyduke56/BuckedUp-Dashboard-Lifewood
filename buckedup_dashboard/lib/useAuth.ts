"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "./supabase/client";
import type { UserRole } from "./types";

interface UseAuthState {
  user: User | null;
  role: UserRole | null;
  mustChangePassword: boolean;
  theme: "dark" | "light";
  loading: boolean;
  signOut: () => Promise<void>;
}

export function useAuth(): UseAuthState {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function loadRole(userId: string) {
      const { data } = await supabase
        .from("profiles")
        .select("role, must_change_password, theme")
        .eq("id", userId)
        .single();
      if (!cancelled) {
        setRole((data?.role as UserRole) ?? null);
        setMustChangePassword(data?.must_change_password ?? false);
        if (data?.theme) {
          setTheme(data.theme as "dark" | "light");
        }
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setLoading(false);
      if (data.session) loadRole(data.session.user.id);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        loadRole(newSession.user.id);
      } else {
        setRole(null);
        setMustChangePassword(false);
        setTheme("light");
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return { user: session?.user ?? null, role, mustChangePassword, theme, loading, signOut };
}
