"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { CATEGORY_TREE, STATUS_ORDER } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import { useProfiles } from "@/lib/useProfiles";
import type { PipelineStatus, Product } from "@/lib/types";
import { VideoVersionsPanel } from "./VideoVersionsPanel";

interface ProductFormModalProps {
  mode: "add" | "edit";
  product: Product | null;
  nextRank: number;
  onClose: () => void;
}

interface FormState {
  rank: string;
  name: string;
  category: string;
  subcategory: string;
  contentType: string;
  language: string;
  productUrl: string;
  contentAngle: string;
  ownerId: string;
  publishDate: string;
  status: PipelineStatus;
  videoUrl: string;
}

function initialState(
  mode: "add" | "edit",
  product: Product | null,
  nextRank: number,
): FormState {
  if (mode === "edit" && product) {
    const item = product.items[0];
    return {
      rank: String(product.rank),
      name: product.name,
      category: product.category,
      subcategory: product.subcategory,
      contentType: product.type,
      language: product.language,
      productUrl: product.productUrl ?? "",
      contentAngle: product.contentAngle,
      ownerId: product.ownerId ?? "",
      publishDate: product.publishDate ?? "",
      status: item.status,
      videoUrl: item.videoUrl ?? "",
    };
  }

  const firstCategory = Object.keys(CATEGORY_TREE)[0];
  return {
    rank: String(nextRank),
    name: "",
    category: firstCategory,
    subcategory: CATEGORY_TREE[firstCategory][0],
    contentType: "",
    language: "English",
    productUrl: "",
    contentAngle: "",
    ownerId: "",
    publishDate: "",
    status: "Not Started",
    videoUrl: "",
  };
}

export function ProductFormModal({
  mode,
  product,
  nextRank,
  onClose,
}: ProductFormModalProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [form, setForm] = useState<FormState>(() =>
    initialState(mode, product, nextRank),
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { profiles } = useProfiles();

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "category") {
        next.subcategory = CATEGORY_TREE[value as string][0];
      }
      return next;
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const rank = Number(form.rank);
    if (!form.name.trim() || !Number.isFinite(rank)) {
      setError("Name and a valid rank are required.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const payload = {
      rank,
      name: form.name.trim(),
      category: form.category,
      subcategory: form.subcategory,
      content_type: form.contentType.trim() || null,
      language: form.language.trim() || "English",
      product_url: form.productUrl.trim() || null,
      content_angle: form.contentAngle.trim() || null,
      owner_id: form.ownerId || null,
      publish_date: form.publishDate || null,
      status: form.status,
      video_url: form.videoUrl.trim() || null,
    };

    const { error: saveError } =
      mode === "edit" && product
        ? await supabase.from("products").update(payload).eq("id", product.id)
        : await supabase.from("products").insert(payload);

    setSubmitting(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    onClose();
  };

  const handleDelete = async () => {
    if (!product) return;
    if (!window.confirm(`Delete "${product.name}"? This can't be undone.`)) {
      return;
    }

    setDeleting(true);
    setError(null);

    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("products")
      .delete()
      .eq("id", product.id);

    setDeleting(false);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    onClose();
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className="overlay show"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div className="modal form-modal">
        <button type="button" className="modal-close" onClick={onClose}>
          ✕
        </button>
        <div className="video-modal-title">
          {mode === "edit" ? `Edit — ${product?.name}` : "Add product"}
        </div>
        <form className="form-grid" onSubmit={handleSubmit}>
          {error ? <div className="callout form-error">{error}</div> : null}

          <label className="form-field">
            <span>Rank</span>
            <input
              type="number"
              value={form.rank}
              onChange={(event) => update("rank", event.target.value)}
              required
            />
          </label>
          <label className="form-field form-field-wide">
            <span>Name</span>
            <input
              type="text"
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              required
            />
          </label>
          <label className="form-field">
            <span>Category</span>
            <select
              value={form.category}
              onChange={(event) => update("category", event.target.value)}
            >
              {Object.keys(CATEGORY_TREE).map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Subcategory</span>
            <select
              value={form.subcategory}
              onChange={(event) => update("subcategory", event.target.value)}
            >
              {CATEGORY_TREE[form.category].map((subcategory) => (
                <option key={subcategory} value={subcategory}>
                  {subcategory}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Stage</span>
            <select
              value={form.status}
              onChange={(event) =>
                update("status", event.target.value as PipelineStatus)
              }
            >
              {STATUS_ORDER.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Content type</span>
            <input
              type="text"
              value={form.contentType}
              onChange={(event) => update("contentType", event.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Language</span>
            <input
              type="text"
              value={form.language}
              onChange={(event) => update("language", event.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Owner</span>
            <select
              value={form.ownerId}
              onChange={(event) => update("ownerId", event.target.value)}
            >
              <option value="">Unassigned</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.email}
                </option>
              ))}
            </select>
            {!form.ownerId && product?.owner ? (
              <span className="form-hint">Sheet-era: {product.owner}</span>
            ) : null}
          </label>
          <label className="form-field">
            <span>Publish date</span>
            <input
              type="date"
              value={form.publishDate}
              onChange={(event) => update("publishDate", event.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Product URL</span>
            <input
              type="url"
              value={form.productUrl}
              onChange={(event) => update("productUrl", event.target.value)}
            />
          </label>
          <label className="form-field">
            <span>{mode === "edit" ? "Video URL (current)" : "Video URL"}</span>
            <input
              type="url"
              value={form.videoUrl}
              readOnly={mode === "edit"}
              disabled={mode === "edit"}
              onChange={(event) => update("videoUrl", event.target.value)}
            />
            {mode === "edit" ? (
              <span className="form-hint">
                Add a new version below to change this.
              </span>
            ) : null}
          </label>
          <label className="form-field form-field-wide">
            <span>Content angle</span>
            <textarea
              value={form.contentAngle}
              onChange={(event) => update("contentAngle", event.target.value)}
              rows={3}
            />
          </label>

          <div className="form-actions">
            {mode === "edit" ? (
              <button
                type="button"
                className="delete-btn"
                onClick={handleDelete}
                disabled={deleting || submitting}
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            ) : (
              <span />
            )}
            <button
              type="submit"
              className="issue-submit-btn"
              disabled={submitting || deleting}
            >
              {submitting
                ? "Saving…"
                : mode === "edit"
                  ? "Save changes"
                  : "Add product"}
            </button>
          </div>
        </form>

        {mode === "edit" && product ? (
          <VideoVersionsPanel
            productId={product.id}
            onVersionAdded={(url) => update("videoUrl", url)}
          />
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
