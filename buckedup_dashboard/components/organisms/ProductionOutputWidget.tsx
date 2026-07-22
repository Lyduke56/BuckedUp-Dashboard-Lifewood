"use client";

import { useState } from "react";
import { Rocket, Calendar, Pencil, Check, X } from "lucide-react";
import { CATEGORY_TREE, computeProjectPacing } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { useProductionPlan } from "@/lib/useProductionPlan";
import { useTodayStats } from "@/lib/useTodayStats";
import { useVideoRequests } from "@/lib/useVideoRequests";
import { Tilt } from "@/components/atoms/Tilt";

export function ProductionOutputWidget() {
  const { plan } = useProductionPlan();
  const todayStats = useTodayStats();
  const { products } = useVideoRequests();
  const { user, role } = useAuth();
  const [editingDeadline, setEditingDeadline] = useState(false);
  const [deadlineDraft, setDeadlineDraft] = useState("");
  const [saving, setSaving] = useState(false);


  // production_plans is admin-only to write (see supabase/schema.sql) —
  // deadline/target configuration moved from super-admin to admin along with the
  // rest of the operational catalog power.
  const canEditDeadline = role === "admin";

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
        <div className="panel panel-glass output-widget w-full flex flex-col justify-between" style={{ flex: 1, height: "100%" }}>
          <div className="output-widget-title">
            <Rocket size={18} color="var(--saffron)" />
            Production output
          </div>
          <div className="empty-state" style={{ marginTop: "12px" }}>
            No production plan configured yet — set daily/stage targets and a
            deadline from Super-Admin ▸ Production plan.
          </div>
        </div>
      </Tilt>
    );
  }

  const userProducts = role === "operator"
    ? products.filter(p => p.ownerId === user?.id)
    : products;

  const dailyGoal = Object.values(plan.categoryTargets || {}).reduce((sum, val) => sum + Number(val), 0);
  const dailyPct = dailyGoal > 0 ? Math.min(100, Math.round((todayStats.publishedToday / dailyGoal) * 100)) : 0;

  const totalTarget = plan.totalVideoTarget || 0;
  const overallStaged = userProducts.filter((p) => p.items[0]?.status !== "Not Started").length;
  const remainingToStage = Math.max(0, totalTarget - overallStaged);
  const stagingPct = totalTarget > 0 ? Math.min(100, Math.round((overallStaged / totalTarget) * 100)) : 0;

  const overallPublished = userProducts.filter((p) => p.items[0]?.status === "Published").length;
  const publishedPct = totalTarget > 0 ? Math.min(100, Math.round((overallPublished / totalTarget) * 100)) : 0;

  const { daysToDeadline } = computeProjectPacing(publishedPct, new Date(), plan.startDate, plan.deadline);
  const daysAbs = Math.abs(daysToDeadline);
  const deadlineText =
    daysToDeadline >= 0
      ? `${daysAbs} day${daysAbs === 1 ? "" : "s"} to delivery`
      : `Overdue by ${daysAbs} day${daysAbs === 1 ? "" : "s"}`;

  const categoryRows = Object.keys(CATEGORY_TREE)
    .map((category) => ({
      category,
      target: plan.categoryTargets[category] ?? 0,
      actual: todayStats.publishedByCategory[category] ?? 0,
    }))
    .filter((row) => row.target > 0);

  return (
    <Tilt maxTilt={6} className="w-full h-full flex">
      <div className="panel panel-glass output-widget w-full flex flex-col justify-between" style={{ flex: 1, height: "100%" }}>
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
        <div className="output-progress-caption" style={{ marginBottom: "16px" }}>
          {dailyPct}% of today&apos;s goal
        </div>

        <div className="content-angle-label">Target per Category</div>
        <div className="output-stage-list">
          {categoryRows.length > 0 ? (
            categoryRows.map((row) => {
              const pct = row.target > 0 ? Math.min(100, Math.round((row.actual / row.target) * 100)) : 0;
              return (
                <div key={row.category} className="snapshot-row">
                  <div className="snapshot-label">{row.category}</div>
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
            <div className="stat-card-empty">No category targets set.</div>
          )}
        </div>

        <div className="content-angle-label" style={{ marginTop: "16px" }}>
          Overall progress
        </div>
        <div style={{ fontSize: "12px", color: "var(--ink-soft)", display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
          <span>Staged: {overallStaged} / {totalTarget}</span>
          <span>{remainingToStage} remaining to stage</span>
        </div>
        <div className="stat-progress-track" style={{ height: "6px" }}>
          <div className="stat-progress-fill" style={{ width: `${stagingPct}%` }} />
        </div>

        <div className="output-deadline-row" style={{ marginTop: "auto" }}>
          <div className="output-deadline-info">
            <Calendar size={14} color="var(--ink-soft)" />
            <span>{deadlineText}</span>
          </div>
          {canEditDeadline ? (
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
