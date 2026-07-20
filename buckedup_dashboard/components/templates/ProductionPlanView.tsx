"use client";

import { useState, useMemo, useRef, type FormEvent } from "react";
import { Film, Grid3x3, Globe } from "lucide-react";
import * as XLSX from "xlsx";
import { CATEGORY_TREE } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import { useProductionPlan } from "@/lib/useProductionPlan";
import { useTodayStats } from "@/lib/useTodayStats";
import { useVideoRequests } from "@/lib/useVideoRequests";
import type { ProductionPlan } from "@/lib/types";

interface ParsedImport {
  name: string;
  totalVideoTarget: number;
  startDate: string;
  deadline: string;
  dailyAccumulativeTargets: Record<string, number>;
}

function parseExcelDate(val: any): Date | null {
  if (val instanceof Date) return val;
  if (typeof val === "number") {
    const date = new Date(Date.UTC(1899, 11, 30));
    date.setUTCDate(date.getUTCDate() + val);
    return date;
  }
  if (typeof val === "string") {
    const parsed = Date.parse(val);
    if (!isNaN(parsed)) return new Date(parsed);
  }
  return null;
}

function formatDateIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseProductionPlanXlsx(file: File): Promise<ParsedImport> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject(new Error("Failed to read the file."));
          return;
        }
        const workbook = XLSX.read(data, { type: "array", cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (rows.length < 2) {
          reject(new Error("The Excel sheet is empty or lacks rows."));
          return;
        }

        const headers = rows[0].map((h) => String(h || "").trim().toLowerCase());
        const dateIdx = headers.indexOf("date");
        const dailyTargetIdx = headers.indexOf("daily target") !== -1
          ? headers.indexOf("daily target")
          : headers.indexOf("daily targets");
        const targetAccumIdx = headers.indexOf("target (accumulative)");

        if (dateIdx === -1) {
          reject(new Error("Missing required column header: 'Date'"));
          return;
        }
        if (dailyTargetIdx === -1) {
          reject(new Error("Missing required column header: 'Daily Target' or 'Daily Targets'"));
          return;
        }

        let firstDateStr: string | null = null;
        let lastDateStr: string | null = null;
        let lastAccumTargetVal = 0;
        let sumDailyTargets = 0;
        const dailyMap: Record<string, number> = {};

        for (let i = 1; i < rows.length; i++) {
          const r = rows[i];
          if (!r || r.length === 0) continue;

          const rawDate = r[dateIdx];
          const rawDailyTarget = r[dailyTargetIdx];
          const rawAccumTarget = targetAccumIdx !== -1 ? r[targetAccumIdx] : undefined;

          if (rawDate !== undefined && rawDate !== null && String(rawDate).trim() !== "") {
            const parsedDate = parseExcelDate(rawDate);
            if (parsedDate) {
              const dateStr = formatDateIso(parsedDate);
              if (!firstDateStr) firstDateStr = dateStr;
              lastDateStr = dateStr;

              if (rawDailyTarget !== undefined && rawDailyTarget !== null && String(rawDailyTarget).trim() !== "") {
                const parsedDaily = Number(rawDailyTarget);
                if (!isNaN(parsedDaily)) {
                  dailyMap[dateStr] = parsedDaily;
                  sumDailyTargets += parsedDaily;
                }
              }

              if (rawAccumTarget !== undefined && rawAccumTarget !== null && String(rawAccumTarget).trim() !== "") {
                const parsedAccum = Number(rawAccumTarget);
                if (!isNaN(parsedAccum)) {
                  lastAccumTargetVal = parsedAccum;
                }
              }
            }
          }
        }

        if (!firstDateStr || !lastDateStr) {
          reject(new Error("No valid dates found in the 'Date' column."));
          return;
        }

        if (Object.keys(dailyMap).length === 0) {
          reject(new Error("No valid target values found in the 'Daily Target' column."));
          return;
        }

        const planName = file.name.replace(/\.[^.]+$/, "");
        const finalTotalVideoTarget = lastAccumTargetVal > 0 ? lastAccumTargetVal : sumDailyTargets;

        resolve({
          name: planName,
          totalVideoTarget: finalTotalVideoTarget,
          startDate: firstDateStr,
          deadline: lastDateStr,
          dailyAccumulativeTargets: dailyMap,
        });
      } catch (err: any) {
        reject(new Error(err?.message || "An error occurred during parsing."));
      }
    };
    reader.onerror = () => reject(new Error("File reading failed."));
    reader.readAsArrayBuffer(file);
  });
}


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

  const [dailyAccumulativeTargets, setDailyAccumulativeTargets] = useState<Record<string, number> | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Targets-only submission states
  const [targetsSubmitting, setTargetsSubmitting] = useState(false);
  const [targetsSaved, setTargetsSaved] = useState(false);
  const [targetsError, setTargetsError] = useState<string | null>(null);

  // Dynamic lists of target categories & custom inputs for languages
  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [customLanguageRowIndices, setCustomLanguageRowIndices] = useState<number[]>([]);

  const handleSaveTargetsOnly = async () => {
    setTargetsSubmitting(true);
    setTargetsError(null);
    setTargetsSaved(false);

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

    const sumCategoryTargets = Object.values(categoryTargets).reduce((acc, val) => acc + val, 0);
    const supabase = createClient();

    try {
      if (plan?.id) {
        const { error: saveErr } = await supabase
          .from("production_plans")
          .update({
            category_targets: categoryTargets,
            language_targets: languageTargets,
          })
          .eq("id", plan.id);

        if (saveErr) throw new Error(saveErr.message);
      } else {
        const today = new Date().toISOString().split("T")[0];
        const { error: insErr } = await supabase.from("production_plans").insert({
          name: form.name.trim() || "Active Production Plan",
          total_video_target: toInt(form.totalVideoTarget),
          start_date: form.startDate || today,
          deadline: form.deadline || today,
          category_targets: categoryTargets,
          language_targets: languageTargets,
          is_active: true,
        });

        if (insErr) throw new Error(insErr.message);
      }

      // Upsert into daily_target_history for today's date so Analytics & charts update live
      const todayStr = new Date().toISOString().split("T")[0];
      const { error: historyErr } = await supabase
        .from("daily_target_history")
        .upsert({ date: todayStr, target: sumCategoryTargets }, { onConflict: "date" });

      if (historyErr) {
        console.warn("Could not log daily_target_history:", historyErr.message);
      }

      setTargetsSubmitting(false);
      setTargetsSaved(true);
      setTimeout(() => setTargetsSaved(false), 2500);
    } catch (err: any) {
      setTargetsSubmitting(false);
      setTargetsError(err?.message || "Failed to save targets.");
    }
  };


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
    setDailyAccumulativeTargets(plan?.dailyAccumulativeTargets ?? null);
    
    // Initialize active categories to those that have targets, or fallback to first category
    const active = Object.keys(initialForm.categoryTargets).filter(
      (cat) => initialForm.categoryTargets[cat] !== "" && initialForm.categoryTargets[cat] !== "0"
    );
    setActiveCategories(active.length > 0 ? active : [Object.keys(CATEGORY_TREE)[0]]);
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportError(null);
    try {
      const parsed = await parseProductionPlanXlsx(file);
      setForm((prev) => ({
        ...prev,
        name: parsed.name,
        totalVideoTarget: String(parsed.totalVideoTarget),
        startDate: parsed.startDate,
        deadline: parsed.deadline,
      }));
      setDailyAccumulativeTargets(parsed.dailyAccumulativeTargets);
    } catch (err: any) {
      setImportError(err?.message || "Failed to parse the Excel file.");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const handleClearImport = () => {
    setDailyAccumulativeTargets(null);
    setImportError(null);
  };

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
      daily_accumulative_targets: dailyAccumulativeTargets,
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

      <form className="form-grid plan-form" onSubmit={handleSubmit} style={{ marginTop: "16px" }}>
        {error ? <div className="callout form-error">{error}</div> : null}
        {saved ? (
          <div className="callout" style={{ borderLeftColor: "var(--castleton)", gridColumn: "1 / -1" }}>
            Saved.
          </div>
        ) : null}

        {/* Excel Import Notice and Action Panel */}
        <div className="form-field-wide" style={{
          background: "var(--glass-bg)",
          borderTop: "1px solid var(--glass-border)",
          borderRight: "1px solid var(--glass-border)",
          borderBottom: "1px solid var(--glass-border)",
          borderLeft: "3px solid var(--castleton)",
          padding: "16px",
          borderRadius: "12px",
          marginBottom: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          gridColumn: "1 / -1"
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
            <span style={{ fontSize: "18px", marginTop: "-2px" }}>⚠️</span>
            <div style={{ fontSize: "13px", lineHeight: "1.5", color: "var(--text-main)" }}>
              <strong style={{ color: "var(--castleton)" }}>Excel Import Notice:</strong> Please ensure your Excel spreadsheet follows a consistent layout. It must contain <strong>Date</strong> and <strong>Daily Target</strong> columns. Importing will automatically populate the Plan Name, Dates, Total Video Target, and Daily Pacing schedule.
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
            <button
              type="button"
              className="issue-submit-btn"
              style={{
                background: "var(--castleton-glow)",
                border: "1px solid var(--castleton)",
                color: "var(--castleton)",
                height: "32px",
                padding: "0 14px",
                borderRadius: "8px",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12px",
                boxShadow: "none"
              }}
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              {importing ? "Parsing..." : "Upload Excel Plan"}
            </button>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              accept=".xlsx,.xls"
              onChange={handleImport}
            />

            {dailyAccumulativeTargets ? (
              <div style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
                <span style={{
                  fontSize: "12px",
                  color: "var(--castleton)",
                  background: "var(--castleton-glow)",
                  padding: "4px 8px",
                  borderRadius: "6px",
                  fontWeight: 600,
                  border: "1px solid var(--castleton)"
                }}>
                  ✓ Pacing schedule loaded ({Object.keys(dailyAccumulativeTargets).length} dates)
                </span>
                <button
                  type="button"
                  style={{
                    background: "rgba(239, 68, 68, 0.08)",
                    border: "1px solid rgba(239, 68, 68, 0.25)",
                    color: "#dc2626",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    padding: "4px 8px",
                    borderRadius: "6px"
                  }}
                  onClick={handleClearImport}
                >
                  Clear Import
                </button>
              </div>
            ) : (
              <span style={{ fontSize: "12px", color: "var(--ink-soft)" }}>
                No imported pacing schedule active (falls back to daily target).
              </span>
            )}
          </div>
          {importError && (
            <div style={{ color: "#dc2626", fontSize: "12px", fontWeight: 600 }}>
              Error: {importError}
            </div>
          )}
        </div>

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

        {/* Primary Plan Submit Button */}
        <div className="form-actions form-field-wide" style={{ marginTop: "4px", marginBottom: "8px" }}>
          <span />
          <button type="submit" className="issue-submit-btn" disabled={submitting}>
            {submitting ? "Saving…" : plan ? "Save plan changes" : "Create plan"}
          </button>
        </div>

        {/* Dropdown-driven output cards — configured targets */}
        <div className="form-field-wide" style={{ marginTop: "16px" }}>
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

          {/* Separate Set Targets button positioned after configuring target cards */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
            {targetsSaved && (
              <span style={{ fontSize: "12px", color: "var(--castleton)", fontWeight: 700 }}>
                ✓ Targets set!
              </span>
            )}
            {targetsError && (
              <span style={{ fontSize: "12px", color: "#dc2626", fontWeight: 700 }}>
                {targetsError}
              </span>
            )}
            <button
              type="button"
              className="issue-submit-btn"
              disabled={targetsSubmitting}
              onClick={handleSaveTargetsOnly}
            >
              {targetsSubmitting ? "Setting targets…" : "Set Targets"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
