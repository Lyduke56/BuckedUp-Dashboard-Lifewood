"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CATEGORY_TREE, STATUS_ORDER } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import { useProfiles } from "@/lib/useProfiles";
import type { PipelineStatus, Product } from "@/lib/types";

interface VideoVersionRow {
  id: string;
  video_url: string;
  note: string | null;
  is_current: boolean;
  created_at: string;
}

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
  reviewStatus: string;
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
      reviewStatus: product.reviewStatus ?? "",
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
    reviewStatus: "",
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
  const [form, setForm] = useState<FormState>(() =>
    initialState(mode, product, nextRank),
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { profiles } = useProfiles();

  const [versions, setVersions] = useState<VideoVersionRow[]>([]);
  const [newVersionUrl, setNewVersionUrl] = useState("");
  const [newVersionNote, setNewVersionNote] = useState("");
  const [addingVersion, setAddingVersion] = useState(false);
  const [versionError, setVersionError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "edit" || !product) return;
    const supabase = createClient();
    supabase
      .from("video_versions")
      .select("id, video_url, note, is_current, created_at")
      .eq("product_id", product.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setVersions(data as VideoVersionRow[]);
      });
  }, [mode, product]);

  const handleAddVersion = async () => {
    if (!product || !newVersionUrl.trim()) return;
    setAddingVersion(true);
    setVersionError(null);

    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("set_current_video_version", {
      p_product_id: product.id,
      p_video_url: newVersionUrl.trim(),
      p_note: newVersionNote.trim() || null,
    });

    setAddingVersion(false);
    if (rpcError) {
      setVersionError(rpcError.message);
      return;
    }

    setNewVersionUrl("");
    setNewVersionNote("");
    const { data } = await supabase
      .from("video_versions")
      .select("id, video_url, note, is_current, created_at")
      .eq("product_id", product.id)
      .order("created_at", { ascending: false });
    if (data) setVersions(data as VideoVersionRow[]);
    update("videoUrl", newVersionUrl.trim());
  };

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
      review_status: form.reviewStatus.trim() || null,
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

  return (
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
            <span>Review status</span>
            <input
              type="text"
              value={form.reviewStatus}
              onChange={(event) => update("reviewStatus", event.target.value)}
              placeholder="Not Started"
            />
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
          <div className="video-versions">
            <div className="content-angle-label">Video versions</div>
            {versionError ? (
              <div className="callout form-error">{versionError}</div>
            ) : null}
            {versions.length === 0 ? (
              <div className="issue-empty">No versions uploaded yet.</div>
            ) : (
              <ul className="video-version-list">
                {versions.map((version) => (
                  <li key={version.id} className="video-version-item">
                    <a href={version.video_url} target="_blank" rel="noopener noreferrer">
                      {version.video_url.replace(/^https?:\/\//, "")}
                    </a>
                    {version.note ? (
                      <span className="video-version-note">{version.note}</span>
                    ) : null}
                    {version.is_current ? (
                      <span className="video-version-current">Current</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            <div className="issue-form">
              <input
                type="url"
                placeholder="New video URL…"
                value={newVersionUrl}
                onChange={(event) => setNewVersionUrl(event.target.value)}
              />
              <input
                type="text"
                placeholder="Note (optional)…"
                value={newVersionNote}
                onChange={(event) => setNewVersionNote(event.target.value)}
              />
              <button
                type="button"
                className="issue-submit-btn"
                disabled={addingVersion || !newVersionUrl.trim()}
                onClick={handleAddVersion}
              >
                {addingVersion ? "Adding…" : "Add version"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
