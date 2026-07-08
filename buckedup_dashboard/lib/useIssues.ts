"use client";

import { useCallback, useEffect, useState } from "react";
import type { Issue, IssueSeverity } from "./types";

interface UseIssuesState {
  issues: Issue[];
  loading: boolean;
  reportIssue: (
    rank: number,
    description: string,
    severity: IssueSeverity,
  ) => Promise<void>;
  resolveIssue: (id: string) => Promise<void>;
}

export function useIssues(): UseIssuesState {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/issues", { cache: "no-store" });
        const json = await res.json();
        if (!cancelled && json.success) setIssues(json.data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/issues", { cache: "no-store" });
    const json = await res.json();
    if (json.success) setIssues(json.data);
  }, []);

  const reportIssue = useCallback(
    async (rank: number, description: string, severity: IssueSeverity) => {
      const res = await fetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rank, description, severity }),
      });
      if (res.ok) await refresh();
    },
    [refresh],
  );

  const resolveIssue = useCallback(
    async (id: string) => {
      const res = await fetch("/api/issues", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "resolved" }),
      });
      if (res.ok) await refresh();
    },
    [refresh],
  );

  return { issues, loading, reportIssue, resolveIssue };
}
