"use client";

import { useState, useRef, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { X, Plus, Trash2, ExternalLink, ImageIcon } from "lucide-react";
import { CATEGORY_TREE } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import { useMounted } from "@/lib/useMounted";
import type { CatalogProduct } from "@/lib/types";

interface CatalogProductFormModalProps {
  mode: "add" | "edit";
  product: CatalogProduct | null;
  onClose: () => void;
}

interface FormState {
  name: string;
  category: string;
  subcategory: string;
  variants: string[];        // managed as an array; rendered as chips
  variantInput: string;      // current text in the tag input
  price: string;
  flagStatus: string;
  productUrl: string;
  isActive: boolean;
}

function initialState(mode: "add" | "edit", product: CatalogProduct | null): FormState {
  if (mode === "edit" && product) {
    return {
      name: product.name,
      category: product.category,
      subcategory: product.subcategory,
      variants: [...product.variants],
      variantInput: "",
      price: product.price ?? "",
      flagStatus: product.flagStatus ?? "",
      productUrl: product.productUrl ?? "",
      isActive: product.isActive,
    };
  }
  const firstCat = Object.keys(CATEGORY_TREE)[0];
  return {
    name: "",
    category: firstCat,
    subcategory: CATEGORY_TREE[firstCat][0],
    variants: [],
    variantInput: "",
    price: "",
    flagStatus: "",
    productUrl: "",
    isActive: true,
  };
}

export function CatalogProductFormModal({
  mode,
  product,
  onClose,
}: CatalogProductFormModalProps) {
  const mounted = useMounted();
  const [form, setForm] = useState<FormState>(() => initialState(mode, product));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Thumbnail state
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(
    mode === "edit" ? (product?.thumbnailUrl ?? null) : null
  );
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "category") {
        next.subcategory = CATEGORY_TREE[value as string]?.[0] ?? "";
      }
      return next;
    });
  };

  // ---------- Variant chip management ----------
  const addVariant = () => {
    const v = form.variantInput.trim();
    if (!v) return;
    const values = v.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
    setForm((prev) => ({
      ...prev,
      variants: [...prev.variants, ...values.filter((vv) => !prev.variants.includes(vv))],
      variantInput: "",
    }));
  };

  const removeVariant = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== idx),
    }));
  };

  const handleVariantKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addVariant();
    }
    if (e.key === "Backspace" && !form.variantInput && form.variants.length > 0) {
      removeVariant(form.variants.length - 1);
    }
  };

  // ---------- Thumbnail ----------
  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setThumbnailFile(file);
    if (file) setThumbnailPreview(URL.createObjectURL(file));
    else setThumbnailPreview(null);
  };

  const uploadThumbnail = async (supabase: ReturnType<typeof createClient>, targetId: string): Promise<string | null> => {
    if (!thumbnailFile) return null;
    const path = `catalog/${targetId}/${Date.now()}-${thumbnailFile.name}`;
    const { error: upErr } = await supabase.storage
      .from("thumbnails")
      .upload(path, thumbnailFile, { contentType: thumbnailFile.type, upsert: true });
    if (upErr) { setError(upErr.message); return null; }
    return supabase.storage.from("thumbnails").getPublicUrl(path).data.publicUrl;
  };

  // ---------- Submit ----------
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError("Product name is required."); return; }

    setSubmitting(true);
    setError(null);
    const supabase = createClient();

    const payload = {
      name: form.name.trim(),
      category: form.category,
      subcategory: form.subcategory,
      variants: form.variants,
      price: form.price.trim() || null,
      flag_status: form.flagStatus.trim() || null,
      product_url: form.productUrl.trim() || null,
      is_active: form.isActive,
    };

    if (mode === "edit" && product) {
      let thumbnailUrl = product.thumbnailUrl ?? null;
      if (thumbnailFile) {
        const uploaded = await uploadThumbnail(supabase, product.id);
        if (!uploaded) { setSubmitting(false); return; }
        thumbnailUrl = uploaded;
      }
      const { error: saveErr } = await supabase
        .from("catalog_products")
        .update({ ...payload, thumbnail_url: thumbnailUrl })
        .eq("id", product.id);
      setSubmitting(false);
      if (saveErr) { setError(saveErr.message); return; }
      onClose();
      return;
    }

    // Add mode
    const { data: inserted, error: insErr } = await supabase
      .from("catalog_products")
      .insert(payload)
      .select("id")
      .single();
    if (insErr) { setSubmitting(false); setError(insErr.message); return; }

    if (thumbnailFile && inserted) {
      const uploaded = await uploadThumbnail(supabase, (inserted as { id: string }).id);
      if (uploaded) {
        await supabase
          .from("catalog_products")
          .update({ thumbnail_url: uploaded })
          .eq("id", (inserted as { id: string }).id);
      }
    }
    setSubmitting(false);
    onClose();
  };

  // ---------- Delete ----------
  const handleDelete = async () => {
    if (!product) return;
    setDeleting(true);
    const supabase = createClient();
    const { error: delErr } = await supabase
      .from("catalog_products")
      .delete()
      .eq("id", product.id);
    setDeleting(false);
    if (delErr) { setError(delErr.message); return; }
    onClose();
  };

  if (!mounted) return null;

  const subcategories = CATEGORY_TREE[form.category] ?? [];

  const modal = (
    <div className="overlay show modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal form-modal modal-panel catalog-form-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 640, width: "100%" }}
      >
        {/* Header */}
        <div className="modal-header flex items-start justify-between p-6 border-b border-white/10 bg-white/[0.02] gap-4 flex-shrink-0">
          <div>
            <div className="modal-overline text-xs font-bold text-[var(--castleton)] uppercase tracking-wider mb-1">PRODUCT CATALOG</div>
            <h2 className="modal-title text-lg font-extrabold text-white m-0">
              {mode === "add" ? "Add Catalog Product" : "Edit Catalog Product"}
            </h2>
          </div>
          <button className="modal-close-btn w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-[var(--ink-soft)] hover:text-white transition-all flex-shrink-0" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body flex-1 p-6 overflow-y-auto flex flex-col gap-5">
          {/* Thumbnail */}
          <div className="catalog-thumb-row flex items-start gap-4 mb-2">
            <div
              className="catalog-thumb-preview w-24 h-24 rounded-2xl bg-black/40 border border-dashed border-white/20 hover:border-[var(--castleton)] cursor-pointer overflow-hidden flex items-center justify-center transition-all flex-shrink-0"
              onClick={() => thumbnailInputRef.current?.click()}
              title="Click to upload thumbnail"
            >
              {thumbnailPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumbnailPreview} alt="Thumbnail preview" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 16 }} />
              ) : (
                <div className="catalog-thumb-placeholder flex flex-col items-center gap-1.5 text-[var(--ink-soft)]">
                  <ImageIcon size={28} className="opacity-40" />
                  <span className="text-[11px] opacity-60 font-semibold">Upload image</span>
                </div>
              )}
            </div>
            <input
              ref={thumbnailInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: "none" }}
              onChange={handleThumbnailChange}
            />
            <div className="catalog-thumb-meta flex-1 flex flex-col gap-2 justify-center py-1">
              <p className="form-help text-xs text-[var(--ink-soft)] m-0">Product thumbnail (optional). Recommended PNG/JPG/WebP, max 5MB.</p>
              {thumbnailPreview && (
                <button
                  type="button"
                  className="btn-ghost-sm text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[var(--ink-soft)] hover:text-white self-start transition-all"
                  onClick={() => { setThumbnailFile(null); setThumbnailPreview(null); }}
                >
                  Remove image
                </button>
              )}
            </div>
          </div>

          {/* Name */}
          <div className="form-group flex flex-col gap-1.5">
            <label className="form-label text-xs font-bold text-[var(--ink-soft)] uppercase tracking-wider">Product Name *</label>
            <input
              className="form-input w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[var(--castleton)] focus:ring-2 focus:ring-[var(--castleton)]/20 transition-all"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="e.g. Woke AF - High Stimulant Pre-Workout"
              required
            />
          </div>

          {/* Category + Subcategory */}
          <div className="form-row-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="form-group flex flex-col gap-1.5">
              <label className="form-label text-xs font-bold text-[var(--ink-soft)] uppercase tracking-wider">Category</label>
              <select
                className="form-select w-full px-3.5 py-2.5 rounded-xl bg-[#0e1512] border border-white/10 text-white text-sm focus:outline-none focus:border-[var(--castleton)] focus:ring-2 focus:ring-[var(--castleton)]/20 transition-all"
                value={form.category}
                onChange={(e) => update("category", e.target.value)}
              >
                {Object.keys(CATEGORY_TREE).map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="form-group flex flex-col gap-1.5">
              <label className="form-label text-xs font-bold text-[var(--ink-soft)] uppercase tracking-wider">Subcategory</label>
              <select
                className="form-select w-full px-3.5 py-2.5 rounded-xl bg-[#0e1512] border border-white/10 text-white text-sm focus:outline-none focus:border-[var(--castleton)] focus:ring-2 focus:ring-[var(--castleton)]/20 transition-all"
                value={form.subcategory}
                onChange={(e) => update("subcategory", e.target.value)}
              >
                {subcategories.map((sub) => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Variants */}
          <div className="form-group flex flex-col gap-1.5">
            <label className="form-label text-xs font-bold text-[var(--ink-soft)] uppercase tracking-wider flex items-center justify-between">
              <span>Variants</span>
              <span className="form-label-count text-xs px-2 py-0.5 rounded-full bg-[var(--castleton)]/20 text-[var(--castleton)] font-extrabold">{form.variants.length}</span>
            </label>
            <div className="variant-tag-input flex flex-wrap items-center gap-2 min-h-[46px] p-2 rounded-xl bg-white/[0.03] border border-white/10 focus-within:border-[var(--castleton)] transition-all">
              {form.variants.map((v, i) => (
                <span key={i} className="variant-chip inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[var(--castleton)]/20 border border-[var(--castleton)]/40 text-[var(--castleton)]">
                  {v}
                  <button
                    type="button"
                    className="variant-chip-remove hover:opacity-100 opacity-70 transition-opacity"
                    onClick={() => removeVariant(i)}
                    aria-label={`Remove ${v}`}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
              <input
                className="variant-chip-input flex-1 min-w-[140px] bg-transparent border-none outline-none text-white text-sm px-1 placeholder-white/30"
                placeholder={form.variants.length === 0 ? "Type a variant and press Enter or comma…" : "Add another…"}
                value={form.variantInput}
                onChange={(e) => update("variantInput", e.target.value)}
                onKeyDown={handleVariantKeyDown}
                onBlur={addVariant}
              />
            </div>
            <p className="form-help text-xs text-[var(--ink-soft)] m-0">Press Enter or comma to add. Backspace to remove last.</p>
          </div>

          {/* Price + Flag */}
          <div className="form-row-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="form-group flex flex-col gap-1.5">
              <label className="form-label text-xs font-bold text-[var(--ink-soft)] uppercase tracking-wider">Price</label>
              <input
                className="form-input w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[var(--castleton)] focus:ring-2 focus:ring-[var(--castleton)]/20 transition-all"
                value={form.price}
                onChange={(e) => update("price", e.target.value)}
                placeholder="$54.99"
              />
            </div>
            <div className="form-group flex flex-col gap-1.5">
              <label className="form-label text-xs font-bold text-[var(--ink-soft)] uppercase tracking-wider">Flag / Status</label>
              <input
                className="form-input w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[var(--castleton)] focus:ring-2 focus:ring-[var(--castleton)]/20 transition-all"
                value={form.flagStatus}
                onChange={(e) => update("flagStatus", e.target.value)}
                placeholder="★ Best Seller #1 / NEW / CLEARANCE"
              />
            </div>
          </div>

          {/* Product URL */}
          <div className="form-group flex flex-col gap-1.5">
            <label className="form-label text-xs font-bold text-[var(--ink-soft)] uppercase tracking-wider">Product Page URL</label>
            <div className="relative w-full">
              <input
                className="form-input w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[var(--castleton)] focus:ring-2 focus:ring-[var(--castleton)]/20 transition-all"
                type="url"
                value={form.productUrl}
                onChange={(e) => update("productUrl", e.target.value)}
                placeholder="https://www.buckedup.com/shop/…"
              />
              {form.productUrl && (
                <a
                  href={form.productUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--castleton)] hover:text-[#10b981] transition-colors"
                >
                  <ExternalLink size={16} />
                </a>
              )}
            </div>
          </div>

          {/* Is Active toggle */}
          <div className="form-group flex items-center gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
            <label className="form-label text-xs font-bold text-white uppercase tracking-wider m-0">Active in Catalog</label>
            <button
              type="button"
              className={`toggle-btn relative w-11 h-6 rounded-full transition-colors flex-shrink-0 border ${form.isActive ? "bg-[var(--castleton)] border-[var(--castleton)]" : "bg-white/10 border-white/20"}`}
              onClick={() => update("isActive", !form.isActive)}
              aria-pressed={form.isActive}
            >
              <span className={`toggle-thumb absolute top-1 left-1 w-3.5 h-3.5 rounded-full bg-white transition-transform ${form.isActive ? "translate-x-5" : "translate-x-0"}`} />
            </button>
            <span className="form-help text-xs text-[var(--ink-soft)] m-0 flex-1">
              {form.isActive ? "Visible to all users across dashboard" : "Hidden (discontinued product)"}
            </span>
          </div>

          {error && <p className="form-error text-xs font-semibold text-[#dc3545] p-3 rounded-xl bg-[#dc3545]/10 border border-[#dc3545]/20">{error}</p>}

          {/* Actions */}
          <div className="modal-actions flex items-center justify-end gap-3 mt-2 pt-4 border-t border-white/10 flex-shrink-0">
            {mode === "edit" && (
              <div className="mr-auto flex items-center">
                {!showDeleteConfirm ? (
                  <button
                    type="button"
                    className="btn-danger-ghost px-4 py-2.5 rounded-xl font-bold text-sm text-[#dc3545] border border-[#dc3545]/30 hover:bg-[#dc3545]/10 flex items-center gap-2 transition-all"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                ) : (
                  <div className="flex gap-2 items-center">
                    <span className="text-xs font-bold text-[var(--earth-yellow)]">Delete this product?</span>
                    <button
                      type="button"
                      className="btn-danger px-4 py-2 rounded-xl font-bold text-xs bg-[#dc3545] text-white hover:bg-[#bb2d3b] transition-all"
                      onClick={handleDelete}
                      disabled={deleting}
                    >
                      {deleting ? "Deleting…" : "Yes, delete"}
                    </button>
                    <button
                      type="button"
                      className="btn-ghost px-3 py-2 rounded-xl font-bold text-xs bg-white/5 border border-white/10 text-[var(--ink-soft)] hover:text-white transition-all"
                      onClick={() => setShowDeleteConfirm(false)}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}
            <button type="button" className="btn-ghost px-5 py-2.5 rounded-xl font-bold text-sm bg-white/5 border border-white/10 text-[var(--ink-soft)] hover:text-white transition-all" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary px-5 py-2.5 rounded-xl font-bold text-sm bg-[var(--castleton)] text-white flex items-center justify-center gap-2 hover:bg-[#08754e] shadow-lg transition-all" disabled={submitting}>
              {submitting ? "Saving…" : mode === "add" ? (
                <><Plus size={15} /> Add Product</>
              ) : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
