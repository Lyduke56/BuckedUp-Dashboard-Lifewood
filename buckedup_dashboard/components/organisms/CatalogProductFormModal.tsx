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
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel catalog-form-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 640, width: "100%" }}
      >
        {/* Header */}
        <div className="modal-header">
          <div>
            <div className="modal-overline">PRODUCT CATALOG</div>
            <h2 className="modal-title">
              {mode === "add" ? "Add Catalog Product" : "Edit Catalog Product"}
            </h2>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {/* Thumbnail */}
          <div className="catalog-thumb-row">
            <div
              className="catalog-thumb-preview"
              onClick={() => thumbnailInputRef.current?.click()}
              title="Click to upload thumbnail"
            >
              {thumbnailPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumbnailPreview} alt="Thumbnail preview" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} />
              ) : (
                <div className="catalog-thumb-placeholder">
                  <ImageIcon size={28} style={{ opacity: 0.35 }} />
                  <span style={{ fontSize: 11, opacity: 0.5, marginTop: 4 }}>Upload image</span>
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
            <div className="catalog-thumb-meta">
              <p className="form-help">Product thumbnail (optional). PNG/JPG/WebP, max 5MB.</p>
              {thumbnailPreview && (
                <button
                  type="button"
                  className="btn-ghost-sm"
                  onClick={() => { setThumbnailFile(null); setThumbnailPreview(null); }}
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          {/* Name */}
          <div className="form-group">
            <label className="form-label">Product Name *</label>
            <input
              className="form-input"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="e.g. Woke AF - High Stimulant Pre-Workout"
              required
            />
          </div>

          {/* Category + Subcategory */}
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Category</label>
              <select
                className="form-select"
                value={form.category}
                onChange={(e) => update("category", e.target.value)}
              >
                {Object.keys(CATEGORY_TREE).map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Subcategory</label>
              <select
                className="form-select"
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
          <div className="form-group">
            <label className="form-label">
              Variants
              <span className="form-label-count">{form.variants.length}</span>
            </label>
            <div className="variant-tag-input">
              {form.variants.map((v, i) => (
                <span key={i} className="variant-chip">
                  {v}
                  <button
                    type="button"
                    className="variant-chip-remove"
                    onClick={() => removeVariant(i)}
                    aria-label={`Remove ${v}`}
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
              <input
                className="variant-chip-input"
                placeholder={form.variants.length === 0 ? "Type a variant and press Enter or comma…" : "Add another…"}
                value={form.variantInput}
                onChange={(e) => update("variantInput", e.target.value)}
                onKeyDown={handleVariantKeyDown}
                onBlur={addVariant}
              />
            </div>
            <p className="form-help">Press Enter or comma to add. Backspace to remove last.</p>
          </div>

          {/* Price + Flag */}
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Price</label>
              <input
                className="form-input"
                value={form.price}
                onChange={(e) => update("price", e.target.value)}
                placeholder="$54.99"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Flag / Status</label>
              <input
                className="form-input"
                value={form.flagStatus}
                onChange={(e) => update("flagStatus", e.target.value)}
                placeholder="★ Best Seller #1 / NEW / CLEARANCE"
              />
            </div>
          </div>

          {/* Product URL */}
          <div className="form-group">
            <label className="form-label">Product Page URL</label>
            <div style={{ position: "relative" }}>
              <input
                className="form-input"
                type="url"
                value={form.productUrl}
                onChange={(e) => update("productUrl", e.target.value)}
                placeholder="https://www.buckedup.com/shop/…"
                style={{ paddingRight: form.productUrl ? 40 : 12 }}
              />
              {form.productUrl && (
                <a
                  href={form.productUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--castleton)" }}
                >
                  <ExternalLink size={15} />
                </a>
              )}
            </div>
          </div>

          {/* Is Active toggle */}
          <div className="form-group" style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <label className="form-label" style={{ margin: 0 }}>Active in Catalog</label>
            <button
              type="button"
              className={`toggle-btn${form.isActive ? " active" : ""}`}
              onClick={() => update("isActive", !form.isActive)}
              aria-pressed={form.isActive}
            >
              <span className="toggle-thumb" />
            </button>
            <span className="form-help" style={{ margin: 0 }}>
              {form.isActive ? "Visible to all users" : "Hidden (discontinued)"}
            </span>
          </div>

          {error && <p className="form-error">{error}</p>}

          {/* Actions */}
          <div className="modal-actions">
            {mode === "edit" && (
              <div style={{ marginRight: "auto" }}>
                {!showDeleteConfirm ? (
                  <button
                    type="button"
                    className="btn-danger-ghost"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                ) : (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: "var(--earth-yellow)" }}>Delete this product?</span>
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={handleDelete}
                      disabled={deleting}
                    >
                      {deleting ? "Deleting…" : "Yes, delete"}
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => setShowDeleteConfirm(false)}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? "Saving…" : mode === "add" ? (
                <><Plus size={14} /> Add Product</>
              ) : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
