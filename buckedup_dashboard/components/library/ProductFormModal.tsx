"use client";

import { useState, useRef, useCallback, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { CATEGORY_TREE, STATUS_ORDER } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import { useProfiles } from "@/lib/useProfiles";
import { useMounted } from "@/lib/useMounted";
import type { DeliveryType, PipelineStatus, Product } from "@/lib/types";
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
  deliveryType: DeliveryType;
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
      deliveryType: product.deliveryType,
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
    deliveryType: "pipeline",
    videoUrl: "",
  };
}

export function ProductFormModal({
  mode,
  product,
  nextRank,
  onClose,
}: ProductFormModalProps) {
  const mounted = useMounted();

  const [form, setForm] = useState<FormState>(() =>
    initialState(mode, product, nextRank),
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { profiles } = useProfiles();

  // Local state for the thumbnail portal
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  // Version upload state (lifted from VideoVersionsPanel)
  const [versionNote, setVersionNote] = useState("");
  const [versionUploading, setVersionUploading] = useState(false);
  const [versionFile, setVersionFile] = useState<File | null>(null);
  const uploadHandlerRef = useRef<(() => Promise<void>) | null>(null);

  const handleUploadReady = useCallback((handler: () => Promise<void>) => {
    uploadHandlerRef.current = handler;
  }, []);

  const handleThumbnailChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setThumbnailFile(file);
    if (file) {
      const previewUrl = URL.createObjectURL(file);
      setThumbnailPreview(previewUrl);
    } else {
      setThumbnailPreview(null);
    }
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

  // Link-only content is submitted straight to Published with its URL —
  // it never enters the pipeline. Only relevant in add mode (delivery
  // type is display-only when editing).
  const isLinkOnly = mode === "add" && form.deliveryType === "link";

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const rank = Number(form.rank);
    if (!form.name.trim() || !Number.isFinite(rank)) {
      setError("Name and a valid rank are required.");
      return;
    }
    if (isLinkOnly && !form.videoUrl.trim()) {
      setError("A content URL is required for link-only content.");
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
      status: isLinkOnly ? "Published" : form.status,
      // form.deliveryType is the toggle in add mode and the preserved
      // existing value in edit mode (display-only there).
      delivery_type: form.deliveryType,
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

        <div className="modal-layout-container">
          {/* LEFT COLUMN: Product Form */}
          <form className="modal-left-column" onSubmit={handleSubmit}>
            {error ? <div className="callout form-error">{error}</div> : null}

            {mode === "add" ? (
              <label className="form-field">
                <span>Delivery type</span>
                <select
                  value={form.deliveryType}
                  onChange={(event) =>
                    update("deliveryType", event.target.value as DeliveryType)
                  }
                >
                  <option value="pipeline">Pipeline content (goes through stages)</option>
                  <option value="link">Link-only (published immediately)</option>
                </select>
                {isLinkOnly ? (
                  <span className="form-hint">
                    Skips the pipeline — submit a URL and it&apos;s counted as
                    Published right away.
                  </span>
                ) : null}
              </label>
            ) : null}

            <label className="form-field">
              <span>Rank</span>
              <input
                type="number"
                value={form.rank}
                onChange={(event) => update("rank", event.target.value)}
                required
              />
            </label>
            <label className="form-field">
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
            {isLinkOnly ? null : (
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
            )}
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
              <span>
                {isLinkOnly
                  ? "Content URL"
                  : mode === "edit"
                    ? "Video URL (current)"
                    : "Video URL"}
              </span>
              <input
                type="url"
                value={form.videoUrl}
                readOnly={mode === "edit"}
                disabled={mode === "edit"}
                required={isLinkOnly}
                onChange={(event) => update("videoUrl", event.target.value)}
              />
              {mode === "edit" ? (
                <span className="form-hint">
                  Add a new version below to change this.
                </span>
              ) : null}
            </label>
            <label className="form-field">
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

          {/* RIGHT COLUMN: Video Versions & Thumbnail Portal */}
          <div className="modal-right-column">
            {mode === "edit" && product ? (
              <VideoVersionsPanel
                productId={product.id}
                onVersionAdded={(url) => update("videoUrl", url)}
                externalControls={true}
                noteValue={versionNote}
                onNoteChange={setVersionNote}
                onUploadReady={handleUploadReady}
                uploading={versionUploading}
                setUploading={setVersionUploading}
                onFileChange={setVersionFile}
              />
            ) : (
              <div className="video-versions">
                <div className="content-angle-label">Video Versions</div>
                <div className="issue-empty">Video versions can be uploaded after creating the product.</div>
              </div>
            )}

            {/* Thumbnail Portal */}
            <div className="thumbnail-portal">
              <div className="content-angle-label">Add thumbnail:</div>
              {/* Clicking the box opens the hidden file input */}
              <div
                className="thumbnail-preview-box"
                onClick={() => thumbnailInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && thumbnailInputRef.current?.click()}
                title="Click to choose a thumbnail image"
              >
                <input
                  ref={thumbnailInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleThumbnailChange}
                  style={{ display: "none" }}
                />
                {thumbnailPreview ? (
                  <img src={thumbnailPreview} alt="Thumbnail preview" className="thumbnail-preview-image" />
                ) : (
                  <div className="thumbnail-placeholder-icon">
                    <span>Click to add thumbnail</span>
                  </div>
                )}
              </div>
            </div>

            {/* Note + Upload Version — rendered below thumbnail */}
            {mode === "edit" && product ? (
              <div className="version-upload-controls">
                <input
                  type="text"
                  className="version-note-input"
                  placeholder="Note (optional)…"
                  value={versionNote}
                  onChange={(e) => setVersionNote(e.target.value)}
                />
                <button
                  type="button"
                  className="issue-submit-btn"
                  disabled={versionUploading || !versionFile}
                  onClick={() => uploadHandlerRef.current?.()}
                >
                  {versionUploading ? "Uploading…" : "Upload version"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
