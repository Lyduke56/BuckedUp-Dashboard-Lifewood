"use client";

import { useState } from "react";
import { Rocket, Calendar, Pencil, Check, X } from "lucide-react";
import { STATUS_ORDER, computeProjectPacing } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { useProductionPlan } from "@/lib/useProductionPlan";
import { useTodayStats } from "@/lib/useTodayStats";
import { Tilt } from "@/components/shared/Tilt";

export function ProductionOutputWidget() {
  const { plan } = useProductionPlan();
  const todayStats = useTodayStats();
  const { role } = useAuth();
  const [editingDeadline, setEditingDeadline] = useState(false);
  const [deadlineDraft, setDeadlineDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const isAdmin = role === "admin";

  const startEdit = () => {
    setDeadlineDraft(plan?.deadline ?? "");
    setEditingDeadline(true);
  };

  const saveDeadline = async () => {
    if (!plan || !deadlineDraft) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from("production_plans").update({ deadline: deadlineDraft }).eq("id", plan.id);
    setSaving(false);
    setEditingDeadline(false);
  };

  if (!plan) {
    return (
      <Tilt maxTilt={6} className="w-full h-full flex">
        <div className="panel panel-glass output-widget">
          <div className="output-widget-title">
            <Rocket size={18} color="var(--saffron)" />
            Production output
          </div>
          <div className="empty-state" style={{ marginTop: "12px" }}>
            No production plan configured yet — set daily/stage targets and a
            deadline from Admin ▸ Production plan.
          </div>
        </div>
      </Tilt>
    );
  }

  const dailyGoal = plan.dailyVideoTarget || 0;
  const dailyPct = dailyGoal > 0 ? Math.min(100, Math.round((todayStats.publishedToday / dailyGoal) * 100)) : 0;

  const { daysToDeadline } = computeProjectPacing(0, new Date(), plan.startDate, plan.deadline);
  const daysAbs = Math.abs(daysToDeadline);
  const deadlineText =
    daysToDeadline >= 0
      ? `${daysAbs} day${daysAbs === 1 ? "" : "s"} to delivery`
      : `Overdue by ${daysAbs} day${daysAbs === 1 ? "" : "s"}`;

  const stageRows = STATUS_ORDER.map((status) => ({
    status,
    target: plan.stageTargets[status] ?? 0,
    actual: todayStats.byStage[status] ?? 0,
  })).filter((row) => row.target > 0);

  return (
    <Tilt maxTilt={6} className="w-full h-full flex">
      <div className="panel panel-glass output-widget">
        <div className="output-widget-title">
          <Rocket size={18} color="var(--saffron)" />
          Today&apos;s target
        </div>

        <div className="output-hero">
          <div className="output-hero-value">
            {todayStats.publishedToday}
            <span className="output-hero-of"> / {dailyGoal || "—"}</span>
          </div>
          <div className="output-hero-label">videos published today</div>
        </div>
        <div className="stat-progress-track">
          <div className="stat-progress-fill" style={{ width: `${dailyPct}%` }} />
        </div>
        <div className="output-progress-caption">{dailyPct}% of today&apos;s goal</div>

        <div className="content-angle-label" style={{ marginTop: "16px" }}>
          Target per stage
        </div>
        <div className="output-stage-list">
          {stageRows.length > 0 ? (
            stageRows.map((row) => {
              const pct = row.target > 0 ? Math.min(100, Math.round((row.actual / row.target) * 100)) : 0;
              return (
                <div key={row.status} className="snapshot-row">
                  <div className="snapshot-label">{row.status}</div>
                  <div className="snapshot-track">
                    <div className="snapshot-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="snapshot-count">
                    {row.actual}/{row.target} today
                  </div>
                </div>
              );
            })
          ) : (
            <div className="stat-card-empty">No per-stage targets set.</div>
          )}
        </div>

        <div className="output-deadline-row">
          <div className="output-deadline-info">
            <Calendar size={14} color="var(--ink-soft)" />
            <span>{deadlineText}</span>
          </div>
          {isAdmin ? (
            editingDeadline ? (
              <div className="output-deadline-edit">
                <input
                  type="date"
                  value={deadlineDraft}
                  onChange={(event) => setDeadlineDraft(event.target.value)}
                />
                <button
                  type="button"
                  className="icon-btn"
                  onClick={saveDeadline}
                  disabled={saving}
                  aria-label="Save deadline"
                >
                  <Check size={14} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setEditingDeadline(false)}
                  aria-label="Cancel"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button type="button" className="icon-btn" onClick={startEdit} aria-label="Edit deadline">
                <Pencil size={13} />
              </button>
            )
          ) : null}
        </div>
      </div>
    </Tilt>
  );
}
