"use client";

import { useState, type FormEvent } from "react";
import { CATEGORY_TREE, STATUS_ORDER } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import { useProductionPlan } from "@/lib/useProductionPlan";
import type { ProductionPlan } from "@/lib/types";

interface FormState {
  name: string;
  totalVideoTarget: string;
  dailyVideoTarget: string;
  startDate: string;
  deadline: string;
  notes: string;
  stageTargets: Record<string, string>;
  languageTargets: { language: string; target: string }[];
  categoryTargets: Record<string, string>;
}

function toFormState(plan: ProductionPlan | null): FormState {
  const stageTargets: Record<string, string> = {};
  STATUS_ORDER.forEach((status) => {
    stageTargets[status] = String(plan?.stageTargets[status] ?? "");
  });

  const categoryTargets: Record<string, string> = {};
  Object.keys(CATEGORY_TREE).forEach((category) => {
    categoryTargets[category] = String(plan?.categoryTargets[category] ?? "");
  });

  const languageTargets = plan
    ? Object.entries(plan.languageTargets).map(([language, target]) => ({
        language,
        target: String(target),
      }))
    : [
        { language: "English", target: "" },
        { language: "Spanish", target: "" },
      ];

  return {
    name: plan?.name ?? "",
    totalVideoTarget: String(plan?.totalVideoTarget ?? ""),
    dailyVideoTarget: String(plan?.dailyVideoTarget ?? ""),
    startDate: plan?.startDate ?? "",
    deadline: plan?.deadline ?? "",
    notes: plan?.notes ?? "",
    stageTargets,
    languageTargets,
    categoryTargets,
  };
}

function toInt(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function ProductionPlanView() {
  const { plan, loading } = useProductionPlan();
  const [form, setForm] = useState<FormState>(() => toFormState(null));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Adjusted during render (React's sanctioned pattern for syncing local
  // state from a loaded value) rather than an effect — re-syncs exactly
  // once when the plan identity changes, not on every keystroke, which
  // lives in local form state until saved.
  const [lastSyncedKey, setLastSyncedKey] = useState<string | undefined>(undefined);
  const currentKey = loading ? undefined : (plan?.id ?? "none");
  if (currentKey !== undefined && currentKey !== lastSyncedKey) {
    setLastSyncedKey(currentKey);
    setForm(toFormState(plan));
  }

  const addLanguageRow = () => {
    setForm((prev) => ({
      ...prev,
      languageTargets: [...prev.languageTargets, { language: "", target: "" }],
    }));
  };

  const removeLanguageRow = (index: number) => {
    setForm((prev) => ({
      ...prev,
      languageTargets: prev.languageTargets.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || !form.startDate || !form.deadline) {
      setError("Name, start date, and deadline are required.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSaved(false);

    const stageTargets: Record<string, number> = {};
    STATUS_ORDER.forEach((status) => {
      const value = toInt(form.stageTargets[status]);
      if (value > 0) stageTargets[status] = value;
    });

    const categoryTargets: Record<string, number> = {};
    Object.keys(CATEGORY_TREE).forEach((category) => {
      const value = toInt(form.categoryTargets[category]);
      if (value > 0) categoryTargets[category] = value;
    });

    const languageTargets: Record<string, number> = {};
    form.languageTargets.forEach(({ language, target }) => {
      const value = toInt(target);
      if (language.trim() && value > 0) languageTargets[language.trim()] = value;
    });

    const payload = {
      name: form.name.trim(),
      total_video_target: toInt(form.totalVideoTarget),
      daily_video_target: toInt(form.dailyVideoTarget),
      start_date: form.startDate,
      deadline: form.deadline,
      notes: form.notes.trim() || null,
      stage_targets: stageTargets,
      language_targets: languageTargets,
      category_targets: categoryTargets,
    };

    const supabase = createClient();
    const { error: saveError } = plan
      ? await supabase.from("production_plans").update(payload).eq("id", plan.id)
      : await supabase.from("production_plans").insert(payload);

    setSubmitting(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (loading) {
    return (
      <div>
        <div className="section-heading">Production plan</div>
        <div className="empty-state">Loading plan…</div>
      </div>
    );
  }

  return (
    <div>
      <div className="section-heading">Production plan</div>
      <div className="section-sub">
        The corporate targets the dashboard measures itself against —
        daily throughput, deadline pacing, and per-stage/language/category
        breakdowns. Public read, admin-only edit.
      </div>

      <form className="form-grid" onSubmit={handleSubmit} style={{ marginTop: "16px" }}>
        {error ? <div className="callout form-error">{error}</div> : null}
        {saved ? (
          <div className="callout" style={{ borderLeftColor: "var(--castleton)", gridColumn: "1 / -1" }}>
            Saved.
          </div>
        ) : null}

        <label className="form-field form-field-wide">
          <span>Plan name</span>
          <input
            type="text"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Q3 2026 Production Plan"
            required
          />
        </label>

        <label className="form-field">
          <span>Total video target</span>
          <input
            type="number"
            min={0}
            value={form.totalVideoTarget}
            onChange={(event) => setForm((prev) => ({ ...prev, totalVideoTarget: event.target.value }))}
          />
        </label>
        <label className="form-field">
          <span>Daily video target</span>
          <input
            type="number"
            min={0}
            value={form.dailyVideoTarget}
            onChange={(event) => setForm((prev) => ({ ...prev, dailyVideoTarget: event.target.value }))}
          />
        </label>

        <label className="form-field">
          <span>Start date</span>
          <input
            type="date"
            value={form.startDate}
            onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))}
            required
          />
        </label>
        <label className="form-field">
          <span>Deadline</span>
          <input
            type="date"
            value={form.deadline}
            onChange={(event) => setForm((prev) => ({ ...prev, deadline: event.target.value }))}
            required
          />
        </label>

        <label className="form-field form-field-wide">
          <span>Notes</span>
          <textarea
            value={form.notes}
            onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
            rows={2}
            placeholder="Context for this plan — pushes, staffing changes, seasonal notes…"
          />
        </label>

        <div className="form-field-wide">
          <div className="content-angle-label">Target videos per stage</div>
          <div className="plan-target-grid">
            {STATUS_ORDER.map((status) => (
              <label key={status} className="form-field">
                <span>{status}</span>
                <input
                  type="number"
                  min={0}
                  value={form.stageTargets[status]}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      stageTargets: { ...prev.stageTargets, [status]: event.target.value },
                    }))
                  }
                />
              </label>
            ))}
          </div>
        </div>

        <div className="form-field-wide">
          <div className="content-angle-label">Target videos per category</div>
          <div className="plan-target-grid">
            {Object.keys(CATEGORY_TREE).map((category) => (
              <label key={category} className="form-field">
                <span>{category}</span>
                <input
                  type="number"
                  min={0}
                  value={form.categoryTargets[category]}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      categoryTargets: { ...prev.categoryTargets, [category]: event.target.value },
                    }))
                  }
                />
              </label>
            ))}
          </div>
        </div>

        <div className="form-field-wide">
          <div className="content-angle-label">Target videos per language</div>
          <div className="plan-language-list">
            {form.languageTargets.map((row, index) => (
              <div key={index} className="plan-language-row">
                <input
                  type="text"
                  placeholder="Language"
                  value={row.language}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      languageTargets: prev.languageTargets.map((r, i) =>
                        i === index ? { ...r, language: event.target.value } : r,
                      ),
                    }))
                  }
                />
                <input
                  type="number"
                  min={0}
                  placeholder="Target"
                  value={row.target}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      languageTargets: prev.languageTargets.map((r, i) =>
                        i === index ? { ...r, target: event.target.value } : r,
                      ),
                    }))
                  }
                />
                <button
                  type="button"
                  className="delete-btn"
                  onClick={() => removeLanguageRow(index)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="header-btn" style={{ marginTop: "8px" }} onClick={addLanguageRow}>
            + Add language
          </button>
        </div>

        <div className="form-actions">
          <span />
          <button type="submit" className="issue-submit-btn" disabled={submitting}>
            {submitting ? "Saving…" : plan ? "Save changes" : "Create plan"}
          </button>
        </div>
      </form>
    </div>
  );
}
