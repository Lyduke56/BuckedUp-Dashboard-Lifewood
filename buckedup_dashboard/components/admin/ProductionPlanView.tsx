"use client";

import { useState, type FormEvent } from "react";
import { Film, Grid3x3, Globe } from "lucide-react";
import { CATEGORY_TREE } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import { useProductionPlan } from "@/lib/useProductionPlan";
import { useTodayStats } from "@/lib/useTodayStats";
import { useVideoRequests } from "@/lib/useVideoRequests";
import type { ProductionPlan } from "@/lib/types";

interface FormState {
  name: string;
  totalVideoTarget: string;
  startDate: string;
  deadline: string;
  notes: string;
  languageTargets: { language: string; target: string }[];
  categoryTargets: Record<string, string>;
}

function toFormState(plan: ProductionPlan | null): FormState {
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
    startDate: plan?.startDate ?? "",
    deadline: plan?.deadline ?? "",
    notes: plan?.notes ?? "",
    languageTargets,
    categoryTargets,
  };
}

function toInt(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

const NEW_LANGUAGE = "__new__";

export function ProductionPlanView() {
  const { plan, loading } = useProductionPlan();
  const todayStats = useTodayStats();
  const { products, loading: productsLoading } = useVideoRequests();
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

  // Which category/language each dropdown card is currently focused
  // on — one at a time, rather than showing every key's input at once.
  const [selectedCategory, setSelectedCategory] = useState<string>(Object.keys(CATEGORY_TREE)[0]);
  const [selectedLanguageIndex, setSelectedLanguageIndex] = useState(0);
  const [newLanguageName, setNewLanguageName] = useState("");
  const [addingLanguage, setAddingLanguage] = useState(false);

  const selectedLanguageRow = form.languageTargets[selectedLanguageIndex] as
    | { language: string; target: string }
    | undefined;

  const setCategoryTarget = (category: string, value: string) => {
    setForm((prev) => ({ ...prev, categoryTargets: { ...prev.categoryTargets, [category]: value } }));
  };

  const setLanguageTargetAt = (index: number, value: string) => {
    setForm((prev) => ({
      ...prev,
      languageTargets: prev.languageTargets.map((row, i) => (i === index ? { ...row, target: value } : row)),
    }));
  };

  const removeLanguageAt = (index: number) => {
    setForm((prev) => ({
      ...prev,
      languageTargets: prev.languageTargets.filter((_, i) => i !== index),
    }));
    setSelectedLanguageIndex(0);
  };

  const confirmAddLanguage = () => {
    const name = newLanguageName.trim();
    if (!name) return;
    setForm((prev) => ({
      ...prev,
      languageTargets: [...prev.languageTargets, { language: name, target: "" }],
    }));
    setSelectedLanguageIndex(form.languageTargets.length);
    setNewLanguageName("");
    setAddingLanguage(false);
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
      start_date: form.startDate,
      deadline: form.deadline,
      notes: form.notes.trim() || null,
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
    return <div className="empty-state">Loading plan…</div>;
  }

  const dailyGoal = Object.values(form.categoryTargets).reduce((acc, val) => acc + toInt(val), 0);
  const dailyPct = dailyGoal > 0 ? Math.min(100, Math.round((todayStats.publishedToday / dailyGoal) * 100)) : 0;

  const categoryGoal = toInt(form.categoryTargets[selectedCategory]);
  const categoryActual = todayStats.publishedByCategory[selectedCategory] ?? 0;
  const categoryPct = categoryGoal > 0 ? Math.min(100, Math.round((categoryActual / categoryGoal) * 100)) : 0;

  const languageGoal = toInt(selectedLanguageRow?.target ?? "");
  const languageActual = selectedLanguageRow
    ? products.filter((p) => p.language === selectedLanguageRow.language && p.items[0]?.status === "Published").length
    : 0;
  const languagePct = languageGoal > 0 ? Math.min(100, Math.round((languageActual / languageGoal) * 100)) : 0;

  // Staged progress analysis
  const totalVideoTarget = toInt(form.totalVideoTarget);
  const stagedCount = products.filter((p) => p.items[0]?.status !== "Not Started").length;
  const remainingToStage = Math.max(0, totalVideoTarget - stagedCount);

  return (
    <div>
      <div className="section-heading">Production plan</div>
      <div className="section-sub">
        The corporate targets the dashboard measures itself against —
        today&apos;s throughput, deadline pacing, and per-language/category
        breakdowns. Public read, admin-only edit.
      </div>

      <form className="form-grid plan-form" onSubmit={handleSubmit} style={{ marginTop: "16px" }}>
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
          {totalVideoTarget > 0 && (
            <span className="form-hint" style={{ color: "var(--accent)", marginTop: "4px" }}>
              {stagedCount} staged so far, {remainingToStage} remaining to stage.
            </span>
          )}
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

        {/* Dropdown-driven output cards — configured targets */}
        <div className="form-field-wide">
          <div className="content-angle-label">Today&apos;s targets</div>
          <div className="stat-card-grid">
            {/* Video output — overall daily target (derived from category targets) */}
            <div className="stat-card">
              <div className="stat-card-header">
                <div className="stat-card-title">
                  <Film size={14} />
                  Video output
                </div>
              </div>
              <div className="stat-tile-row">
                <div className="stat-tile">
                  <div className="stat-tile-value">{todayStats.publishedToday}</div>
                  <div className="stat-tile-label">Today&apos;s videos</div>
                </div>
                <div className="stat-tile">
                  <div className="stat-tile-value">{dailyGoal}</div>
                  <div className="stat-tile-label">Today&apos;s target (derived)</div>
                </div>
                <div className="stat-tile">
                  <div className="stat-tile-value">{dailyPct}%</div>
                  <div className="stat-tile-label">
                    {dailyGoal > 0 ? `${Math.max(0, dailyGoal - todayStats.publishedToday)} to go` : "Goal progress"}
                  </div>
                </div>
              </div>
              <div className="stat-progress-track">
                <div className="stat-progress-fill" style={{ width: `${dailyPct}%` }} />
              </div>
            </div>

            {/* Category output — pick one category, set its daily goal. */}
            <div className="stat-card">
              <div className="stat-card-header">
                <div className="stat-card-title">
                  <Grid3x3 size={14} />
                  Category output
                </div>
                <select
                  className="stat-card-select"
                  value={selectedCategory}
                  onChange={(event) => setSelectedCategory(event.target.value)}
                >
                  {Object.keys(CATEGORY_TREE).map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              <div className="stat-tile-row">
                <div className="stat-tile">
                  <div className="stat-tile-value">{categoryActual}</div>
                  <div className="stat-tile-label">Published today</div>
                </div>
                <div className="stat-tile">
                  <div className="stat-tile-value">
                    <input
                      type="number"
                      min={0}
                      value={form.categoryTargets[selectedCategory]}
                      onChange={(event) => setCategoryTarget(selectedCategory, event.target.value)}
                    />
                  </div>
                  <div className="stat-tile-label">Daily goal</div>
                </div>
                <div className="stat-tile">
                  <div className="stat-tile-value">{categoryPct}%</div>
                  <div className="stat-tile-label">
                    {categoryGoal > 0 ? `${Math.max(0, categoryGoal - categoryActual)} to go` : "Goal progress"}
                  </div>
                </div>
              </div>
              <div className="stat-progress-track">
                <div className="stat-progress-fill" style={{ width: `${categoryPct}%` }} />
              </div>
            </div>

            {/* Language output — pick one language, set its overall total goal */}
            <div className="stat-card">
              <div className="stat-card-header">
                <div className="stat-card-title">
                  <Globe size={14} />
                  Language output
                </div>
                {!addingLanguage ? (
                  <select
                     className="stat-card-select"
                     value={selectedLanguageIndex}
                     onChange={(event) => {
                       if (event.target.value === NEW_LANGUAGE) {
                         setAddingLanguage(true);
                         return;
                       }
                       setSelectedLanguageIndex(Number(event.target.value));
                     }}
                   >
                     {form.languageTargets.map((row, index) => (
                       <option key={index} value={index}>
                         {row.language || "(unnamed)"}
                       </option>
                     ))}
                     <option value={NEW_LANGUAGE}>+ Add language…</option>
                   </select>
                ) : null}
              </div>

              {addingLanguage ? (
                <div className="plan-language-row" style={{ gridTemplateColumns: "1fr auto auto" }}>
                  <input
                    type="text"
                    placeholder="Language name"
                    value={newLanguageName}
                    onChange={(event) => setNewLanguageName(event.target.value)}
                    autoFocus
                  />
                  <button type="button" className="header-btn" onClick={confirmAddLanguage}>
                    Add
                  </button>
                  <button
                    type="button"
                    className="delete-btn"
                    onClick={() => {
                      setAddingLanguage(false);
                      setNewLanguageName("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : selectedLanguageRow ? (
                <>
                  <div className="stat-tile-row">
                    <div className="stat-tile">
                      <div className="stat-tile-value">{languageActual}</div>
                      <div className="stat-tile-label">Overall published</div>
                    </div>
                    <div className="stat-tile">
                      <div className="stat-tile-value">
                        <input
                          type="number"
                          min={0}
                          value={selectedLanguageRow.target}
                          onChange={(event) => setLanguageTargetAt(selectedLanguageIndex, event.target.value)}
                        />
                      </div>
                      <div className="stat-tile-label">Overall target</div>
                    </div>
                    <div className="stat-tile">
                      <div className="stat-tile-value">{languagePct}%</div>
                      <div className="stat-tile-label">
                        {languageGoal > 0 ? `${Math.max(0, languageGoal - languageActual)} to go` : "Goal progress"}
                      </div>
                    </div>
                  </div>
                  <div className="stat-progress-track">
                    <div className="stat-progress-fill" style={{ width: `${languagePct}%` }} />
                  </div>
                  <button
                    type="button"
                    className="delete-btn"
                    style={{ alignSelf: "flex-start" }}
                    onClick={() => removeLanguageAt(selectedLanguageIndex)}
                  >
                    Remove {selectedLanguageRow.language || "language"}
                  </button>
                </>
              ) : (
                <div className="stat-card-empty">No languages configured yet.</div>
              )}
            </div>
          </div>
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
