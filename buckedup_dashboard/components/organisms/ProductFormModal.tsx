"use client";

import { useState, useRef, useCallback, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { CATEGORY_TREE, STATUS_ORDER } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import { useProfiles } from "@/lib/useProfiles";
import { useMounted } from "@/lib/useMounted";
import { useAuth } from "@/lib/useAuth";
import { useStageDeliverables } from "@/lib/useStageDeliverables";
import { DELIVERABLE_STAGES } from "@/lib/types";
import type { DeliveryType, PipelineStatus, Product } from "@/lib/types";
import { VideoVersionsPanel } from "@/components/organisms/VideoVersionsPanel";

const DOC_ACCEPT =
  ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

interface ProductFormModalProps {
  mode: "add" | "edit";
  product: Product | null;
  nextRank: number;
  onClose: () => void;
}

interface FormState {
  rank: string;
  priority: "High" | "Medium" | "Low";
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
      rank: String(product.rank ?? nextRank ?? 0),
      priority: product.priority ?? "Low",
      name: product.name ?? "",
      category: product.category ?? "",
      subcategory: product.subcategory ?? "",
      contentType: product.type ?? "",
      language: product.language ?? "",
      productUrl: product.productUrl ?? "",
      contentAngle: product.contentAngle ?? "",
      ownerId: product.ownerId ?? "",
      publishDate: product.publishDate ?? "",
      status: (product.ownerId && item.status === "Not Started") ? "Design" : item.status,
      deliveryType: product.deliveryType ?? "pipeline",
      videoUrl: item.videoUrl ?? "",
    };
  }

  const firstCategory = Object.keys(CATEGORY_TREE)[0];
  return {
    rank: String(nextRank),
    priority: "Low",
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

const COMMON_LANGUAGES = ["English", "Spanish", "French", "German", "Italian", "Japanese", "Chinese"];

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
  const { user, role } = useAuth();
  const { currentByKey } = useStageDeliverables();
  const hasStoryboard = product ? !!currentByKey.get(`${product.id}:Storyboarding`) : false;
  const hasScript = product ? !!currentByKey.get(`${product.id}:Scripting`) : false;
  const hasSubmittedAnyDeliverables = hasStoryboard || hasScript;
  const isOperator = role === "operator";
  const canEditThumbnail = !isOperator;

  const currentStatus = product ? product.items[0].status : null;
  const [activeSubStage, setActiveSubStage] = useState<"Storyboarding" | "Scripting">("Storyboarding");

  const currentDeliverable = product && currentStatus
    ? (currentStatus === "Design"
      ? (currentByKey.get(`${product.id}:${activeSubStage}`) ?? null)
      : null)
    : null;
  const isDeliverableStage = currentStatus === "Design";

  const [delKind, setDelKind] = useState<"file" | "text">("file");
  const [delText, setDelText] = useState("");
  const [delError, setDelError] = useState<string | null>(null);
  const [delSubmitting, setDelSubmitting] = useState(false);
  const [delSubmittingReview, setDelSubmittingReview] = useState(false);
  const delFileInputRef = useRef<HTMLInputElement>(null);

  // Adjusted during render (React's sanctioned pattern for syncing local
  // state from a changed value) rather than an effect — resets delKind
  // exactly once when currentStatus changes, not on every render.
  const [lastSyncedStatus, setLastSyncedStatus] = useState(currentStatus);
  if (currentStatus !== lastSyncedStatus) {
    setLastSyncedStatus(currentStatus);
    setDelKind("file");
  }

  const handleDeliverableSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || currentStatus !== "Design") return;

    const file = delFileInputRef.current?.files?.[0] ?? null;

    if (file && file.size > 25 * 1024 * 1024) {
      setDelError("Deliverable file size must be less than 25MB.");
      return;
    }

    if (delKind === "file" && !file) {
      setDelError("Choose a file to upload.");
      return;
    }
    if (delKind === "text" && !delText.trim()) {
      setDelError("Enter the deliverable text.");
      return;
    }

    setDelSubmitting(true);
    setDelError(null);

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? null;

    let fileUrl: string | null = null;
    if (delKind === "file" && file) {
      const path = `${product.id}/${activeSubStage}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("stage-documents")
        .upload(path, file, { contentType: file.type });
      if (upErr) {
        setDelSubmitting(false);
        setDelError(upErr.message);
        return;
      }
      fileUrl = supabase.storage.from("stage-documents").getPublicUrl(path).data
        .publicUrl;
    }

    const { error: insErr } = await supabase.from("stage_deliverables").insert({
      product_id: product.id,
      stage: activeSubStage,
      kind: delKind,
      file_url: fileUrl,
      text_content: delKind === "text" ? delText.trim() : null,
      submitted_by: uid,
    });

    setDelSubmitting(false);
    if (insErr) {
      setDelError(insErr.message);
      return;
    }

    // Clear the form
    setDelText("");
    if (delFileInputRef.current) delFileInputRef.current.value = "";
  };

  const handleVideoSubmitForReview = async () => {
    if (!product) return;
    setDelSubmittingReview(true);
    setDelError(null);
    const supabase = createClient();
    const { error: rpcErr } = await supabase.rpc("submit_video_for_review", {
      p_product_id: product.id,
    });
    setDelSubmittingReview(false);
    if (rpcErr) {
      setDelError(rpcErr.message);
      return;
    }
  };

  const handleClaimOwnership = async () => {
    if (!product || !user) return;
    if (!window.confirm(`Are you sure you want to claim "${product.name}"?`)) {
      return;
    }
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("products")
      .update({ owner_id: user.id, status: "Design" })
      .eq("id", product.id);
    setSubmitting(false);
    if (error) {
      setError(error.message);
    } else {
      update("ownerId", user.id);
      update("status", "Design");
    }
  };

  const handleUnclaimOwnership = async () => {
    if (!product || !user) return;
    if (!window.confirm(`Are you sure you want to unclaim "${product.name}"?`)) {
      return;
    }
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("products")
      .update({ owner_id: null, status: "Not Started" })
      .eq("id", product.id);
    setSubmitting(false);
    if (error) {
      setError(error.message);
    } else {
      update("ownerId", "");
      update("status", "Not Started");
    }
  };

  // Local state for the thumbnail portal — seeded from the existing
  // thumbnail in edit mode so it shows until a new one is chosen.
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(
    mode === "edit" ? (product?.thumbnailUrl ?? null) : null,
  );
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
    if (file && file.size > 5 * 1024 * 1024) {
      setError("Thumbnail file size must be less than 5MB.");
      if (thumbnailInputRef.current) thumbnailInputRef.current.value = "";
      return;
    }
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
      // is only for compatibility/unique constraint under the hood.
      rank,
      priority: form.priority,
      name: form.name.trim(),
      category: form.category,
      subcategory: form.subcategory,
      content_type: form.contentType.trim() || null,
      language: form.language.trim() || "English",
      product_url: form.productUrl.trim() || null,
      content_angle: form.contentAngle.trim() || null,
      owner_id: form.ownerId || null,
      publish_date: form.publishDate || null,
      status: isLinkOnly ? "Published" : (form.ownerId && form.status === "Not Started" ? "Design" : form.status),
      // form.deliveryType is the toggle in add mode and the preserved
      // existing value in edit mode (display-only there).
      delivery_type: form.deliveryType,
      video_url: form.videoUrl.trim() || null,
    };

    // Upload the thumbnail. On edit the product id is known up front; on
    // add we don't have an id until after the insert, so we upload+patch
    // afterwards (avoids client-side id generation, which this codebase
    // doesn't do anywhere else).
    const uploadThumbnail = async (targetId: string): Promise<string | null> => {
      if (!thumbnailFile) return null;
      const path = `${targetId}/${Date.now()}-${thumbnailFile.name}`;
      const { error: upErr } = await supabase.storage
        .from("thumbnails")
        .upload(path, thumbnailFile, { contentType: thumbnailFile.type, upsert: true });
      if (upErr) {
        setError(upErr.message);
        return null;
      }
      return supabase.storage.from("thumbnails").getPublicUrl(path).data.publicUrl;
    };

    if (mode === "edit" && product) {
      let thumbnailUrl = product.thumbnailUrl ?? null;
      if (thumbnailFile) {
        const uploaded = await uploadThumbnail(product.id);
        if (!uploaded) {
          setSubmitting(false);
          return;
        }
        thumbnailUrl = uploaded;
      }
      const { error: saveError } = await supabase
        .from("products")
        .update({ ...payload, thumbnail_url: thumbnailUrl })
        .eq("id", product.id);
      setSubmitting(false);
      if (saveError) {
        setError(saveError.message);
        return;
      }
      onClose();
      return;
    }

    // Add mode: insert, then upload+patch the thumbnail if one was chosen.
    const { data: inserted, error: insertError } = await supabase
      .from("products")
      .insert(payload)
      .select("id")
      .single();
    if (insertError) {
      setSubmitting(false);
      setError(insertError.message);
      return;
    }
    if (thumbnailFile && inserted) {
      const uploaded = await uploadThumbnail((inserted as { id: string }).id);
      if (uploaded) {
        await supabase
          .from("products")
          .update({ thumbnail_url: uploaded })
          .eq("id", (inserted as { id: string }).id);
      }
    }
    setSubmitting(false);
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
              <span>Priority</span>
              <select
                value={form.priority}
                disabled={isOperator}
                onChange={(event) => update("priority", event.target.value as "High" | "Medium" | "Low")}
              >
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </label>
            <label className="form-field">
              <span>Name</span>
              <input
                type="text"
                value={form.name}
                disabled={isOperator}
                onChange={(event) => update("name", event.target.value)}
                required
              />
            </label>
            <label className="form-field">
              <span>Category</span>
              <select
                value={form.category}
                disabled={isOperator}
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
                disabled={isOperator}
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
                <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>Stage</span>
                  <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "6px", backgroundColor: "rgba(245, 158, 11, 0.12)", color: "var(--saffron)", border: "1px solid rgba(245, 158, 11, 0.25)" }}>
                    🔒 Managed via QA Review
                  </span>
                </span>
                <div style={{ position: "relative" }}>
                  <select
                    value={form.status}
                    disabled={true}
                    style={{
                      cursor: "not-allowed",
                      opacity: 0.6,
                      border: "1px dashed var(--border-color, rgba(255, 255, 255, 0.15))",
                      paddingRight: "36px",
                      appearance: "none",
                      WebkitAppearance: "none",
                    }}
                  >
                    {STATUS_ORDER.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <span
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      fontSize: "12px",
                      pointerEvents: "none",
                      opacity: 0.7,
                    }}
                  >
                    🔒
                  </span>
                </div>
                <span className="form-hint" style={{ fontSize: "12px", marginTop: "4px" }}>
                  Stage transitions occur automatically through QA reviews.
                </span>
              </label>
            )}
            <label className="form-field">
              <span>Content type</span>
              <input
                type="text"
                value={form.contentType}
                disabled={isOperator}
                onChange={(event) => update("contentType", event.target.value)}
              />
            </label>
            <label className="form-field">
              <span>Language</span>
              <select
                value={COMMON_LANGUAGES.includes(form.language) ? form.language : (form.language === "" ? "English" : "Other")}
                disabled={isOperator}
                onChange={(event) => {
                  const val = event.target.value;
                  if (val === "Other") {
                    update("language", "");
                  } else {
                    update("language", val);
                  }
                }}
                className="mb-2"
              >
                {COMMON_LANGUAGES.map(lang => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
                <option value="Other">Other...</option>
              </select>
              {!COMMON_LANGUAGES.includes(form.language) ? (
                <input
                  type="text"
                  placeholder="Enter language"
                  value={form.language}
                  disabled={isOperator}
                  onChange={(event) => update("language", event.target.value)}
                />
              ) : null}
            </label>
            <label className="form-field">
              <span>Owner</span>
              {isOperator ? (
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <span className="detail-value" style={{ flexGrow: 1, padding: "8px 12px", background: "var(--bg-soft)", borderRadius: "8px", border: "1px solid var(--line)" }}>
                    {product?.ownerId ? (profiles.find(p => p.id === product.ownerId)?.email ?? product.owner ?? "Assigned") : "Unassigned"}
                  </span>
                  {!product?.ownerId && user && (
                    <button
                      type="button"
                      className="issue-submit-btn"
                      style={{ whiteSpace: "nowrap", height: "38px" }}
                      disabled={submitting}
                      onClick={handleClaimOwnership}
                    >
                      {submitting ? "Claiming..." : "Claim"}
                    </button>
                  )}
                  {product?.ownerId === user?.id && !hasSubmittedAnyDeliverables && (
                    <button
                      type="button"
                      className="issue-submit-btn issue-delete-btn"
                      disabled={submitting}
                      onClick={handleUnclaimOwnership}
                    >
                      {submitting ? "Unclaiming..." : "Unclaim"}
                    </button>
                  )}
                </div>
              ) : (
                <select
                  value={form.ownerId}
                  onChange={async (event) => {
                    const newOwnerId = event.target.value;
                    let newStatus = form.status;

                    if (newOwnerId && form.status === "Not Started") {
                      newStatus = "Design";
                    } else if (!newOwnerId && form.status === "Design") {
                      newStatus = "Not Started";
                    }

                    // Immediately save to DB if editing, matching the instant "Claim" behavior
                    if (mode === "edit" && product) {
                      setSubmitting(true);
                      const supabase = createClient();
                      const { error: assignErr } = await supabase
                        .from("products")
                        .update({ owner_id: newOwnerId || null, status: newStatus })
                        .eq("id", product.id);
                      setSubmitting(false);
                      if (assignErr) {
                        setError(assignErr.message);
                        return;
                      }
                    }

                    setForm((prev) => ({ ...prev, ownerId: newOwnerId, status: newStatus }));
                  }}
                >
                  <option value="">Unassigned</option>
                  {profiles.filter(p => p.role === "operator").map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.email}
                    </option>
                  ))}
                </select>
              )}
              {!form.ownerId && product?.owner ? (
                <span className="form-hint">Sheet-era: {product.owner}</span>
              ) : null}
            </label>
            <label className="form-field">
              <span>Publish date</span>
              <input
                type="date"
                value={form.publishDate}
                disabled={isOperator}
                onChange={(event) => update("publishDate", event.target.value)}
              />
            </label>
            <label className="form-field">
              <span>Product URL</span>
              <input
                type="url"
                value={form.productUrl}
                disabled={isOperator}
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
                disabled={isOperator}
                onChange={(event) => update("contentAngle", event.target.value)}
                rows={3}
              />
            </label>

            {/* Thumbnail Portal */}
            <div className="thumbnail-portal" style={!canEditThumbnail ? { pointerEvents: "none", opacity: 0.8 } : undefined}>
              <div className="content-angle-label">{!canEditThumbnail ? "Thumbnail" : "Add thumbnail:"}</div>
              {/* Clicking the box opens the hidden file input */}
              <div
                className="thumbnail-preview-box"
                onClick={() => canEditThumbnail && thumbnailInputRef.current?.click()}
                role="button"
                tabIndex={!canEditThumbnail ? -1 : 0}
                onKeyDown={(e) => canEditThumbnail && e.key === "Enter" && thumbnailInputRef.current?.click()}
                title={!canEditThumbnail ? undefined : "Click to choose a thumbnail image"}
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
                    <span>{!canEditThumbnail ? "No thumbnail" : "Click to add thumbnail"}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="form-actions">
              <>
                {mode === "edit" && !isOperator ? (
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
                {!isOperator && (
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
                )}
              </>
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



            {/* Note + Upload Version — rendered below video versions (Operator only) */}
            {mode === "edit" && product && isOperator ? (
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
                  {versionUploading ? "Uploading…" : "Upload video version"}
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
