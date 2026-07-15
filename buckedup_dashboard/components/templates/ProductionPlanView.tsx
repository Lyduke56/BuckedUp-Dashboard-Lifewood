"use client";

import { useState, useMemo, type FormEvent } from "react";
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

  const languageTargets = plan && Object.keys(plan.languageTargets).length > 0
    ? Object.entries(plan.languageTargets).map(([language, target]) => ({
        language,
        target: String(target),
      }))
    : [
        { language: "English", target: "" },
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

export function ProductionPlanView() {
  const { plan, loading } = useProductionPlan();
  const todayStats = useTodayStats();
  const { products, loading: productsLoading } = useVideoRequests();
  const [form, setForm] = useState<FormState>(() => toFormState(null));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Dynamic lists of target categories & custom inputs for languages
  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [customLanguageRowIndices, setCustomLanguageRowIndices] = useState<number[]>([]);

  // Adjusted during render (React's sanctioned pattern for syncing local
  // state from a loaded value) rather than an effect — re-syncs exactly
  // once when the plan identity changes, not on every keystroke, which
  // lives in local form state until saved.
  const [lastSyncedKey, setLastSyncedKey] = useState<string | undefined>(undefined);
  const currentKey = loading ? undefined : (plan?.id ?? "none");
  if (currentKey !== undefined && currentKey !== lastSyncedKey) {
    setLastSyncedKey(currentKey);
    const initialForm = toFormState(plan);
    setForm(initialForm);
    
    // Initialize active categories to those that have targets, or fallback to first category
    const active = Object.keys(initialForm.categoryTargets).filter(
      (cat) => initialForm.categoryTargets[cat] !== "" && initialForm.categoryTargets[cat] !== "0"
    );
    setActiveCategories(active.length > 0 ? active : [Object.keys(CATEGORY_TREE)[0]]);
  }

  const setCategoryTarget = (category: string, value: string) => {
    setForm((prev) => ({ ...prev, categoryTargets: { ...prev.categoryTargets, [category]: value } }));
  };

  const getAvailableCategories = (currentIndex: number) => {
    const selectedElsewhere = activeCategories.filter((_, idx) => idx !== currentIndex);
    return Object.keys(CATEGORY_TREE).filter((cat) => !selectedElsewhere.includes(cat));
  };

  const handleAddCategory = (index: number) => {
    const available = Object.keys(CATEGORY_TREE).filter((cat) => !activeCategories.includes(cat));
    if (available.length === 0) return;
    const newCat = available[0];
    const updated = [...activeCategories];
    updated.splice(index + 1, 0, newCat);
    setActiveCategories(updated);
    setForm((prev) => ({
      ...prev,
      categoryTargets: {
        ...prev.categoryTargets,
        [newCat]: prev.categoryTargets[newCat] || "",
      },
    }));
  };

  const handleDeleteCategory = (index: number) => {
    if (activeCategories.length <= 1) return;
    const removedCategory = activeCategories[index];
    const updated = activeCategories.filter((_, idx) => idx !== index);
    setActiveCategories(updated);
    setForm((prev) => ({
      ...prev,
      categoryTargets: {
        ...prev.categoryTargets,
        [removedCategory]: "",
      },
    }));
  };

  const handleChangeCategory = (index: number, newCat: string) => {
    const oldCat = activeCategories[index];
    const updated = [...activeCategories];
    updated[index] = newCat;
    setActiveCategories(updated);
    setForm((prev) => {
      const nextTargets = { ...prev.categoryTargets };
      nextTargets[newCat] = nextTargets[oldCat];
      nextTargets[oldCat] = "";
      return {
        ...prev,
        categoryTargets: nextTargets,
      };
    });
  };

  // Collect unique language options from the products catalog dynamically, plus standard defaults
  const ALL_LANGUAGES = useMemo(() => {
    const uniqueProductLanguages = Array.from(new Set(products.map((p) => p.language))).filter(Boolean);
    return Array.from(new Set(["English", "Spanish", "German", "French", "Italian", "Japanese", "Chinese", ...uniqueProductLanguages]));
  }, [products]);

  const getAvailableLanguages = (currentIndex: number) => {
    const selectedElsewhere = form.languageTargets
      .filter((_, idx) => idx !== currentIndex)
      .map((row) => row.language);
    return ALL_LANGUAGES.filter((lang) => !selectedElsewhere.includes(lang));
  };

  const handleAddLanguage = (index: number) => {
    const selectedLanguages = form.languageTargets.map((row) => row.language);
    const available = ALL_LANGUAGES.filter((lang) => !selectedLanguages.includes(lang));
    if (available.length === 0) return;
    const newLang = available[0];
    const updated = [...form.languageTargets];
    updated.splice(index + 1, 0, { language: newLang, target: "" });
    setForm((prev) => ({
      ...prev,
      languageTargets: updated,
    }));
  };

  const handleDeleteLanguage = (index: number) => {
    if (form.languageTargets.length <= 1) return;
    const updated = form.languageTargets.filter((_, idx) => idx !== index);
    setForm((prev) => ({
      ...prev,
      languageTargets: updated,
    }));
  };

  const handleChangeLanguage = (index: number, newLang: string) => {
    setForm((prev) => ({
      ...prev,
      languageTargets: prev.languageTargets.map((row, idx) =>
        idx === index ? { ...row, language: newLang } : row
      ),
    }));
  };

  const setLanguageTargetAt = (index: number, value: string) => {
    setForm((prev) => ({
      ...prev,
      languageTargets: prev.languageTargets.map((row, i) => (i === index ? { ...row, target: value } : row)),
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

            {/* Category output — multiple active categories in a list */}
            <div className="stat-card">
              <div className="stat-card-header" style={{ marginBottom: "4px" }}>
                <div className="stat-card-title">
                  <Grid3x3 size={14} />
                  Category output
                </div>
              </div>
              <div className="plan-targets-scroll-container">
                {activeCategories.map((cat, idx) => {
                  const categoryGoal = toInt(form.categoryTargets[cat]);
                  const categoryActual = todayStats.publishedByCategory[cat] ?? 0;
                  const categoryPct = categoryGoal > 0 ? Math.min(100, Math.round((categoryActual / categoryGoal) * 100)) : 0;

                  const availableCats = getAvailableCategories(idx);
                  const options = [cat, ...availableCats.filter((c) => c !== cat)];

                  return (
                    <div key={idx} className="plan-target-row-container">
                      <div className="plan-target-row-header">
                        <select
                          className="stat-card-select plan-target-row-select"
                          value={cat}
                          onChange={(e) => handleChangeCategory(idx, e.target.value)}
                        >
                          {options.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                        <div className="plan-target-row-buttons">
                          <button
                            type="button"
                            className="plan-target-btn plan-target-btn-add"
                            onClick={() => handleAddCategory(idx)}
                            title="Add target section below"
                          >
                            Add
                          </button>
                          {activeCategories.length > 1 && (
                            <button
                              type="button"
                              className="plan-target-btn plan-target-btn-delete"
                              onClick={() => handleDeleteCategory(idx)}
                              title="Delete target section"
                            >
                              Delete
                            </button>
                          )}
                        </div>
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
                              value={form.categoryTargets[cat]}
                              onChange={(event) => setCategoryTarget(cat, event.target.value)}
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
                  );
                })}
              </div>
            </div>

            {/* Language output — multiple active languages in a list */}
            <div className="stat-card">
              <div className="stat-card-header" style={{ marginBottom: "4px" }}>
                <div className="stat-card-title">
                  <Globe size={14} />
                  Language output
                </div>
              </div>
              <div className="plan-targets-scroll-container">
                {form.languageTargets.length === 0 ? (
                  <div className="stat-card-empty">No languages configured yet.</div>
                ) : (
                  form.languageTargets.map((row, idx) => {
                    const languageGoal = toInt(row.target);
                    const languageActual = products.filter((p) => p.language === row.language && p.items[0]?.status === "Published").length;
                    const languagePct = languageGoal > 0 ? Math.min(100, Math.round((languageActual / languageGoal) * 100)) : 0;

                    const availableLangs = getAvailableLanguages(idx);
                    const options = [row.language, ...availableLangs.filter((l) => l !== row.language)];

                    return (
                      <div key={idx} className="plan-target-row-container">
                        <div className="plan-target-row-header">
                          {customLanguageRowIndices.includes(idx) ? (
                            <input
                              type="text"
                              placeholder="Enter language..."
                              style={{
                                flex: 1,
                                fontFamily: "var(--font-manrope)",
                                fontSize: "12px",
                                fontWeight: 700,
                                padding: "6px 10px",
                                borderRadius: "8px",
                                border: "1px solid var(--line)",
                                background: "var(--white)",
                                color: "var(--ink)",
                                height: "28px",
                              }}
                              onBlur={(e) => {
                                const val = e.target.value.trim();
                                if (val) {
                                  setForm((prev) => {
                                    const updated = [...prev.languageTargets];
                                    updated[idx] = { ...updated[idx], language: val };
                                    return { ...prev, languageTargets: updated };
                                  });
                                }
                                setCustomLanguageRowIndices((prev) => prev.filter((i) => i !== idx));
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  const val = (e.target as HTMLInputElement).value.trim();
                                  if (val) {
                                    setForm((prev) => {
                                      const updated = [...prev.languageTargets];
                                      updated[idx] = { ...updated[idx], language: val };
                                      return { ...prev, languageTargets: updated };
                                    });
                                  }
                                  setCustomLanguageRowIndices((prev) => prev.filter((i) => i !== idx));
                                }
                              }}
                              autoFocus
                            />
                          ) : (
                            <select
                              className="stat-card-select plan-target-row-select"
                              value={row.language}
                              onChange={(e) => {
                                if (e.target.value === "__add_custom__") {
                                  setCustomLanguageRowIndices((prev) => [...prev, idx]);
                                } else {
                                  handleChangeLanguage(idx, e.target.value);
                                }
                              }}
                            >
                              {options.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                              <option value="__add_custom__">+ Add custom...</option>
                            </select>
                          )}
                          <div className="plan-target-row-buttons">
                            <button
                              type="button"
                              className="plan-target-btn plan-target-btn-add"
                              onClick={() => handleAddLanguage(idx)}
                              title="Add target language section below"
                            >
                              Add
                            </button>
                            {form.languageTargets.length > 1 && (
                              <button
                                type="button"
                                className="plan-target-btn plan-target-btn-delete"
                                onClick={() => handleDeleteLanguage(idx)}
                                title="Delete target language"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
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
                                value={row.target}
                                onChange={(event) => setLanguageTargetAt(idx, event.target.value)}
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
                      </div>
                    );
                  })
                )}
              </div>
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
