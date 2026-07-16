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
    <div className="overlay show modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal form-modal modal-panel"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 620, width: "100%" }}
      >
        {/* Header */}
        <div className="modal-header flex items-start justify-between p-6 border-b border-white/10 bg-white/[0.02] gap-4 flex-shrink-0">
          <div>
            <div className="modal-overline text-xs font-bold text-[var(--castleton)] uppercase tracking-wider mb-1">VIDEO LIBRARY</div>
            <h2 className="modal-title text-lg font-extrabold text-white flex items-center gap-2 m-0">
              <Video size={18} className="text-[var(--castleton)] flex-shrink-0" />
              Request AIGC Video from Catalog
            </h2>
          </div>
          <button className="modal-close-btn w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-[var(--ink-soft)] hover:text-white transition-all flex-shrink-0" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body flex-1 p-6 overflow-y-auto flex flex-col gap-5">
          {/* If no product is currently selected, show the catalog product picker */}
          {!activeCatalogProduct ? (
            <div className="mb-2 flex flex-col gap-3">
              <label className="form-label text-xs font-bold text-[var(--ink-soft)] uppercase tracking-wider">
                Select Product from Catalog *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="relative sm:col-span-2">
                  <input
                    className="form-input w-full pl-3.5 pr-9 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[var(--castleton)] focus:ring-2 focus:ring-[var(--castleton)]/20 transition-all"
                    placeholder="Search catalog product by name..."
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                  />
                  <Search size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-soft)] pointer-events-none" />
                </div>
                <select
                  className="form-select w-full px-3.5 py-2.5 rounded-xl bg-[#0e1512] border border-white/10 text-white text-sm focus:outline-none focus:border-[var(--castleton)] focus:ring-2 focus:ring-[var(--castleton)]/20 transition-all"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="all">All Categories</option>
                  {Object.keys(CATEGORY_TREE).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="max-h-56 overflow-y-auto border border-white/10 rounded-xl p-2 bg-black/30 flex flex-col gap-1.5">
                {catalogLoading ? (
                  <div className="p-6 text-center text-sm text-[var(--ink-soft)] font-semibold">
                    Loading catalog products...
                  </div>
                ) : filteredCatalog.length === 0 ? (
                  <div className="p-6 text-center text-sm text-[var(--ink-soft)] font-semibold">
                    No matching catalog products found.
                  </div>
                ) : (
                  filteredCatalog.map((p) => {
                    const isSelected = selectedCatalogId === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelectedCatalogId(p.id)}
                        className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border ${isSelected
                          ? "bg-[var(--castleton)]/20 border-[var(--castleton)] text-white"
                          : "bg-white/[0.02] border-transparent hover:bg-white/5 text-white"
                          }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-lg bg-black/40 flex-shrink-0 overflow-hidden flex items-center justify-center border border-white/10">
                            {p.thumbnailUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.thumbnailUrl} alt={p.name} className="w-full h-full object-cover" />
                            ) : (
                              <Package size={18} className="text-[var(--ink-soft)] opacity-40" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-bold truncate text-white">{p.name}</div>
                            <div className="text-xs text-[var(--ink-soft)] font-semibold">
                              {p.category} &bull; {p.subcategory}
                            </div>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-[var(--castleton)] flex items-center justify-center text-white flex-shrink-0 shadow-md">
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
            <div className="request-catalog-summary flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/10 relative">
              {activeCatalogProduct.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activeCatalogProduct.thumbnailUrl}
                  alt={activeCatalogProduct.name}
                  className="request-catalog-thumb w-16 h-16 rounded-xl object-cover border border-white/10 flex-shrink-0"
                />
              ) : (
                <div className="request-catalog-thumb w-16 h-16 rounded-xl flex items-center justify-center bg-black/40 border border-white/10 flex-shrink-0">
                  <Package size={24} className="text-[var(--ink-soft)] opacity-40" />
                </div>
              )}
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <div className="request-catalog-name text-sm font-extrabold text-white truncate">{activeCatalogProduct.name}</div>
                <div className="request-catalog-meta flex items-center gap-2">
                  <span className="status-pill text-[11px] font-bold px-2 py-0.5 rounded-full bg-[var(--castleton)]/20 text-[var(--castleton)] border border-[var(--castleton)]/30">
                    {activeCatalogProduct.category}
                  </span>
                  <span className="text-xs font-semibold text-[var(--ink-soft)] truncate">
                    {activeCatalogProduct.subcategory}
                  </span>
                </div>
                {activeCatalogProduct.variants.length > 0 && (
                  <div className="request-catalog-variants flex flex-wrap gap-1.5 mt-1">
                    {activeCatalogProduct.variants.slice(0, 4).map((v) => (
                      <span key={v} className="variant-chip-sm text-[11px] font-bold px-2 py-0.5 rounded bg-white/5 text-[var(--ink-soft)] border border-white/10">{v}</span>
                    ))}
                    {activeCatalogProduct.variants.length > 4 && (
                      <span className="variant-chip-more text-[11px] font-bold px-2 py-0.5 rounded bg-white/5 text-[var(--ink-soft)] border border-white/10">+{activeCatalogProduct.variants.length - 4}</span>
                    )}
                  </div>
                )}
              </div>
              {!catalogProduct && (
                <button
                  type="button"
                  onClick={() => setSelectedCatalogId("")}
                  className="btn-ghost-sm text-xs font-bold px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[var(--ink-soft)] hover:text-white transition-all self-start flex-shrink-0"
                >
                  Change Product
                </button>
              )}
            </div>
          )}

          <p className="text-xs text-[var(--ink-soft)] font-semibold m-0 bg-white/[0.02] p-3 rounded-xl border border-white/5">
            Fill in the production details below. Name, category, subcategory, and product URL are
            pre-filled from the catalog and cannot be changed here.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="form-row-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="form-group flex flex-col gap-1.5">
                <label className="form-label text-xs font-bold text-[var(--ink-soft)] uppercase tracking-wider">Rank *</label>
                <input
                  className="form-input w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[var(--castleton)] focus:ring-2 focus:ring-[var(--castleton)]/20 transition-all"
                  type="number"
                  min={1}
                  value={form.rank}
                  onChange={(e) => update("rank", e.target.value)}
                  required
                />
              </div>
              <div className="form-group flex flex-col gap-1.5">
                <label className="form-label text-xs font-bold text-[var(--ink-soft)] uppercase tracking-wider">Language</label>
                <select
                  className="form-select w-full px-3.5 py-2.5 rounded-xl bg-[#0e1512] border border-white/10 text-white text-sm focus:outline-none focus:border-[var(--castleton)] focus:ring-2 focus:ring-[var(--castleton)]/20 transition-all"
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

            <div className="form-group flex flex-col gap-1.5">
              <label className="form-label text-xs font-bold text-[var(--ink-soft)] uppercase tracking-wider">Content Type</label>
              <input
                className="form-input w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[var(--castleton)] focus:ring-2 focus:ring-[var(--castleton)]/20 transition-all"
                value={form.contentType}
                onChange={(e) => update("contentType", e.target.value)}
                placeholder="e.g. Product Demo, Testimonial, Tutorial…"
              />
            </div>

            <div className="form-group flex flex-col gap-1.5">
              <label className="form-label text-xs font-bold text-[var(--ink-soft)] uppercase tracking-wider">Content Angle / Brief</label>
              <textarea
                className="form-textarea w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[var(--castleton)] focus:ring-2 focus:ring-[var(--castleton)]/20 transition-all min-h-[88px]"
                rows={3}
                value={form.contentAngle}
                onChange={(e) => update("contentAngle", e.target.value)}
                placeholder="Describe the focus or angle for this video…"
              />
            </div>

            <div className="form-group flex flex-col gap-1.5">
              <label className="form-label text-xs font-bold text-[var(--ink-soft)] uppercase tracking-wider">Assign Operator</label>
              <select
                className="form-select w-full px-3.5 py-2.5 rounded-xl bg-[#0e1512] border border-white/10 text-white text-sm focus:outline-none focus:border-[var(--castleton)] focus:ring-2 focus:ring-[var(--castleton)]/20 transition-all"
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

            {error && <p className="form-error text-xs font-semibold text-[#dc3545] p-3 rounded-xl bg-[#dc3545]/10 border border-[#dc3545]/20">{error}</p>}

            <div className="modal-actions flex items-center justify-end gap-3 mt-2 pt-4 border-t border-white/10 flex-shrink-0">
              <button type="button" className="btn-ghost px-5 py-2.5 rounded-xl font-bold text-sm bg-white/5 border border-white/10 text-[var(--ink-soft)] hover:text-white transition-all" onClick={onClose}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary px-5 py-2.5 rounded-xl font-bold text-sm bg-[var(--castleton)] text-white flex items-center justify-center gap-2 hover:bg-[#08754e] shadow-lg transition-all"
                disabled={submitting || !activeCatalogProduct}
              >
                {submitting ? "Creating…" : (
                  <><Video size={15} /> Request Video</>
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
