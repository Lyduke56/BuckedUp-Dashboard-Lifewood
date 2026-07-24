"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "./supabase/client";
import type { UserRole, ViewId } from "./types";

interface UseAuthState {
  user: User | null;
  role: UserRole | null;
  mustChangePassword: boolean;
  theme: "dark" | "light";
  tabPermissions: ViewId[] | null;
  isReadOnly: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

export function useAuth(): UseAuthState {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const [tabPermissions, setTabPermissions] = useState<ViewId[] | null>(null);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function loadRole(userId: string) {
      // 1. Fetch core profile columns guaranteed to exist
      const { data: coreData } = await supabase
        .from("profiles")
        .select("role, must_change_password, theme")
        .eq("id", userId)
        .single();

      if (!cancelled && coreData) {
        setRole((coreData.role as UserRole) ?? null);
        setMustChangePassword(coreData.must_change_password ?? false);
        if (coreData.theme) {
          setTheme(coreData.theme as "dark" | "light");
        }
      }

      // 2. Fetch optional permission columns safely (handles cases before SQL migration is applied)
      try {
        const { data: permData } = await supabase
          .from("profiles")
          .select("tab_permissions, is_read_only")
          .eq("id", userId)
          .single();

        if (!cancelled && permData) {
          if (Array.isArray(permData.tab_permissions) && permData.tab_permissions.length > 0) {
            setTabPermissions(permData.tab_permissions as ViewId[]);
          } else {
            setTabPermissions(null);
          }
          setIsReadOnly(Boolean(permData.is_read_only));
        }
      } catch {
        if (!cancelled) {
          setTabPermissions(null);
          setIsReadOnly(false);
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
        setTabPermissions(null);
        setIsReadOnly(false);
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

  return {
    user: session?.user ?? null,
    role,
    mustChangePassword,
    theme,
    tabPermissions,
    isReadOnly,
    loading,
    signOut,
  };
}
