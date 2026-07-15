"use client";

import { useState, useMemo, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { X, Video, Search, Package, Check } from "lucide-react";
import { CATEGORY_TREE } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import { useMounted } from "@/lib/useMounted";
import { useProfiles } from "@/lib/useProfiles";
import { useCatalog } from "@/lib/useCatalog";
import type { CatalogProduct } from "@/lib/types";

interface RequestVideoModalProps {
  /** The catalog product selected as the source, or null/undefined if choosing inside the modal */
  catalogProduct?: CatalogProduct | null;
  /** Next available rank for ordering the new products row */
  nextRank: number;
  /** Called after a successful insert, so the parent can refresh or navigate */
  onSuccess: () => void;
  onClose: () => void;
}

interface FormState {
  rank: string;
  language: string;
  contentType: string;
  contentAngle: string;
  ownerId: string;
}

export function RequestVideoModal({
  catalogProduct,
  nextRank,
  onSuccess,
  onClose,
}: RequestVideoModalProps) {
  const mounted = useMounted();
  const { profiles } = useProfiles();
  const { catalog, loading: catalogLoading } = useCatalog();

  const [form, setForm] = useState<FormState>({
    rank: String(nextRank),
    language: "English",
    contentType: "",
    contentAngle: "",
    ownerId: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Selector state when no initial catalogProduct is provided
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>(catalogProduct?.id ?? "");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [catalogSearch, setCatalogSearch] = useState("");

  const activeCatalogProduct = useMemo(() => {
    if (catalogProduct) return catalogProduct;
    return catalog.find((p) => p.id === selectedCatalogId) ?? null;
  }, [catalogProduct, catalog, selectedCatalogId]);

  const filteredCatalog = useMemo(() => {
    const q = catalogSearch.toLowerCase().trim();
    return catalog.filter((p) => {
      if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
      if (q && !p.name.toLowerCase().includes(q) && !p.subcategory.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [catalog, catalogSearch, categoryFilter]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeCatalogProduct) {
      setError("Please select a product from the catalog first.");
      return;
    }

    const rank = Number(form.rank);
    if (!Number.isFinite(rank)) {
      setError("A valid rank number is required.");
      return;
    }

    setSubmitting(true);
    setError(null);
    const supabase = createClient();

    // Resolve the selected profile's display name for the denormalised `owner`
    // column (matches the existing products schema pattern).
    const selectedProfile = profiles.find((p) => p.id === form.ownerId);

    const { error: insErr } = await supabase.from("products").insert({
      rank,
      name: activeCatalogProduct.name,
      category: activeCatalogProduct.category,
      subcategory: activeCatalogProduct.subcategory,
      language: form.language.trim() || "English",
      content_type: form.contentType.trim() || null,
      content_angle: form.contentAngle.trim() || null,
      owner_id: form.ownerId || null,
      owner: selectedProfile?.email ?? null,
      product_url: activeCatalogProduct.productUrl ?? null,
      status: "Not Started",
      delivery_type: "pipeline",
      catalog_product_id: activeCatalogProduct.id,
    });

    setSubmitting(false);
    if (insErr) {
      setError(insErr.message);
      return;
    }

    onSuccess();
    onClose();
  };

  if (!mounted) return null;

  const modal = (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 620, width: "100%" }}
      >
        {/* Header */}
        <div className="modal-header">
          <div>
            <div className="modal-overline">VIDEO LIBRARY</div>
            <h2 className="modal-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Video size={18} style={{ color: "var(--castleton)" }} />
              Request AIGC Video from Catalog
            </h2>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* If no product is currently selected, show the catalog product picker */}
          {!activeCatalogProduct ? (
            <div className="mb-6">
              <label className="form-label mb-2 block font-semibold text-[var(--text-main)]">
                Select Product from Catalog *
              </label>
              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]" />
                  <input
                    className="form-input pl-8"
                    placeholder="Search catalog product by name..."
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                  />
                </div>
                <select
                  className="form-select w-44"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="all">All Categories</option>
                  {Object.keys(CATEGORY_TREE).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="max-h-60 overflow-y-auto border border-[var(--glass-border)] rounded-xl p-2 bg-[var(--glass-bg)] flex flex-col gap-1.5">
                {catalogLoading ? (
                  <div className="p-6 text-center text-sm text-[var(--ink-soft)]">
                    Loading catalog products...
                  </div>
                ) : filteredCatalog.length === 0 ? (
                  <div className="p-6 text-center text-sm text-[var(--ink-soft)]">
                    No matching catalog products found.
                  </div>
                ) : (
                  filteredCatalog.map((p) => {
                    const isSelected = selectedCatalogId === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelectedCatalogId(p.id)}
                        className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all border ${
                          isSelected
                            ? "bg-[var(--castleton)]/15 border-[var(--castleton)] text-[var(--text-main)]"
                            : "bg-black/20 border-transparent hover:bg-white/5 text-[var(--text-main)]"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded bg-black/40 flex-shrink-0 overflow-hidden flex items-center justify-center border border-white/5">
                            {p.thumbnailUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.thumbnailUrl} alt={p.name} className="w-full h-full object-cover" />
                            ) : (
                              <Package size={16} className="text-[var(--ink-soft)] opacity-40" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold truncate">{p.name}</div>
                            <div className="text-xs text-[var(--ink-soft)]">
                              {p.category} &bull; {p.subcategory}
                            </div>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-[var(--castleton)] flex items-center justify-center text-white flex-shrink-0">
                            <Check size={14} />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            /* Selected catalog summary box */
            <div className="request-catalog-summary relative mb-5">
              {activeCatalogProduct.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activeCatalogProduct.thumbnailUrl}
                  alt={activeCatalogProduct.name}
                  className="request-catalog-thumb"
                />
              ) : (
                <div className="request-catalog-thumb flex items-center justify-center bg-black/30">
                  <Package size={24} className="text-[var(--ink-soft)] opacity-40" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="request-catalog-name">{activeCatalogProduct.name}</div>
                <div className="request-catalog-meta">
                  <span className="status-pill st-not-started" style={{ fontSize: 11 }}>
                    {activeCatalogProduct.category}
                  </span>
                  <span style={{ color: "var(--ink-soft)", fontSize: 12 }}>
                    {activeCatalogProduct.subcategory}
                  </span>
                </div>
                {activeCatalogProduct.variants.length > 0 && (
                  <div className="request-catalog-variants">
                    {activeCatalogProduct.variants.slice(0, 4).map((v) => (
                      <span key={v} className="variant-chip-sm">{v}</span>
                    ))}
                    {activeCatalogProduct.variants.length > 4 && (
                      <span className="variant-chip-more">+{activeCatalogProduct.variants.length - 4}</span>
                    )}
                  </div>
                )}
              </div>
              {!catalogProduct && (
                <button
                  type="button"
                  onClick={() => setSelectedCatalogId("")}
                  className="btn-ghost-sm text-xs self-start"
                >
                  Change Product
                </button>
              )}
            </div>
          )}

          <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 20 }}>
            Fill in the production details below. Name, category, subcategory, and product URL are
            pre-filled from the catalog and cannot be changed here.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label">Rank *</label>
                <input
                  className="form-input"
                  type="number"
                  min={1}
                  value={form.rank}
                  onChange={(e) => update("rank", e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Language</label>
                <select
                  className="form-select"
                  value={form.language}
                  onChange={(e) => update("language", e.target.value)}
                >
                  <option>English</option>
                  <option>Spanish</option>
                  <option>French</option>
                  <option>German</option>
                  <option>Portuguese</option>
                  <option>Japanese</option>
                  <option>Korean</option>
                  <option>Chinese</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Content Type</label>
              <input
                className="form-input"
                value={form.contentType}
                onChange={(e) => update("contentType", e.target.value)}
                placeholder="e.g. Product Demo, Testimonial, Tutorial…"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Content Angle / Brief</label>
              <textarea
                className="form-textarea"
                rows={3}
                value={form.contentAngle}
                onChange={(e) => update("contentAngle", e.target.value)}
                placeholder="Describe the focus or angle for this video…"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Assign Operator</label>
              <select
                className="form-select"
                value={form.ownerId}
                onChange={(e) => update("ownerId", e.target.value)}
              >
                <option value="">— Unassigned —</option>
                {profiles
                  .filter((p) => p.role === "operator" || p.role === "lead")
                  .map((p) => (
                    <option key={p.id} value={p.id}>{p.email}</option>
                  ))}
              </select>
            </div>

            {error && <p className="form-error">{error}</p>}

            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={onClose}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={submitting || !activeCatalogProduct}
              >
                {submitting ? "Creating…" : (
                  <><Video size={14} /> Request Video</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
