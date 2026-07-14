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
  const { user, role } = useAuth();
  const { currentByKey } = useStageDeliverables();
  const isOperator = role === "operator";

  const currentStatus = product ? product.items[0].status : null;
  const currentDeliverable = product && currentStatus ? (currentByKey.get(`${product.id}:${currentStatus}`) ?? null) : null;
  const isDeliverableStage = currentStatus && (DELIVERABLE_STAGES as string[]).includes(currentStatus);

  const [delKind, setDelKind] = useState<"file" | "text">(
    currentStatus === "Prompting" ? "text" : "file",
  );
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
    setDelKind(currentStatus === "Prompting" ? "text" : "file");
  }

  const handleDeliverableSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || !currentStatus) return;

    const effectiveKind = currentStatus === "Prompting" ? "text" : delKind;
    const file = delFileInputRef.current?.files?.[0] ?? null;

    if (effectiveKind === "file" && !file) {
      setDelError("Choose a file to upload.");
      return;
    }
    if (effectiveKind === "text" && !delText.trim()) {
      setDelError("Enter the deliverable text.");
      return;
    }

    setDelSubmitting(true);
    setDelError(null);

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? null;

    let fileUrl: string | null = null;
    if (effectiveKind === "file" && file) {
      const path = `${product.id}/${currentStatus}/${Date.now()}-${file.name}`;
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
      stage: currentStatus,
      kind: effectiveKind,
      file_url: fileUrl,
      text_content: effectiveKind === "text" ? delText.trim() : null,
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
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("products")
      .update({ owner_id: user.id })
      .eq("id", product.id);
    setSubmitting(false);
    if (error) {
      setError(error.message);
    } else {
      update("ownerId", user.id);
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
              <span>Rank</span>
              <input
                type="number"
                value={form.rank}
                disabled={isOperator}
                onChange={(event) => update("rank", event.target.value)}
                required
              />
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
                <span>Stage</span>
                <select
                  value={form.status}
                  disabled={isOperator}
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
                disabled={isOperator}
                onChange={(event) => update("contentType", event.target.value)}
              />
            </label>
            <label className="form-field">
              <span>Language</span>
              <input
                type="text"
                value={form.language}
                disabled={isOperator}
                onChange={(event) => update("language", event.target.value)}
              />
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
                </div>
              ) : (
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
            <div className="thumbnail-portal" style={isOperator ? { pointerEvents: "none", opacity: 0.8 } : undefined}>
              <div className="content-angle-label">{isOperator ? "Thumbnail" : "Add thumbnail:"}</div>
              {/* Clicking the box opens the hidden file input */}
              <div
                className="thumbnail-preview-box"
                onClick={() => !isOperator && thumbnailInputRef.current?.click()}
                role="button"
                tabIndex={isOperator ? -1 : 0}
                onKeyDown={(e) => !isOperator && e.key === "Enter" && thumbnailInputRef.current?.click()}
                title={isOperator ? undefined : "Click to choose a thumbnail image"}
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

             <div className="form-actions">
              {isOperator ? (
                <button
                  type="button"
                  className="pill"
                  onClick={onClose}
                  style={{ marginLeft: "auto", height: "38px", borderRadius: "12px", padding: "0 20px" }}
                >
                  Close
                </button>
              ) : (
                <>
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
                </>
              )}
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



            {/* Note + Upload Version — rendered below video versions (Lead only or Operator who can submit) */}
            {mode === "edit" && product && (!isOperator || (isOperator && (product.ownerId === user?.id || !product.ownerId) && currentStatus === "Editing")) ? (
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

            {/* Operator/Stage Deliverables Section */}
            {mode === "edit" && product && currentStatus && isOperator && (
              <div className="operator-deliverables-panel" style={{ marginTop: "20px", borderTop: "1px solid var(--line)", paddingTop: "20px" }}>
                <div className="content-angle-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span>Stage Deliverable ({currentStatus})</span>
                  {currentDeliverable && (
                    <span className="status-pill" style={{
                      backgroundColor:
                        currentDeliverable.decision === "accepted"
                          ? "var(--castleton)20"
                          : currentDeliverable.decision === "rejected"
                            ? "#dc354520"
                            : "var(--saffron)20",
                      color:
                        currentDeliverable.decision === "accepted"
                          ? "var(--castleton)"
                          : currentDeliverable.decision === "rejected"
                            ? "#dc3545"
                            : "var(--saffron)",
                      border: "none",
                      fontSize: "10px",
                      textTransform: "uppercase"
                    }}>
                      {currentDeliverable.decision}
                    </span>
                  )}
                </div>

                {delError ? <div className="callout form-error" style={{ margin: "8px 0" }}>{delError}</div> : null}

                {currentDeliverable?.decision === "rejected" && currentDeliverable.decisionNote && (
                  <div className="callout form-error" style={{ margin: "8px 0", backgroundColor: "#dc354510", color: "#dc3545", borderColor: "#dc354530" }}>
                    <strong>Rejection reason:</strong> {currentDeliverable.decisionNote}
                  </div>
                )}

                {product.ownerId !== user?.id && product.ownerId ? (
                  <div className="issue-empty" style={{ marginTop: "12px", color: "var(--ink-soft)" }}>
                    Only the assigned owner can submit deliverables for this product.
                  </div>
                ) : isDeliverableStage ? (
                  <form onSubmit={handleDeliverableSubmit} style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    {currentStatus !== "Prompting" && (
                      <label className="form-field" style={{ margin: 0 }}>
                        <span>Deliverable type</span>
                        <select
                          value={delKind}
                          onChange={(event) => setDelKind(event.target.value as "file" | "text")}
                        >
                          <option value="file">File (PDF or DOCX)</option>
                          <option value="text">Text</option>
                        </select>
                      </label>
                    )}

                    {(currentStatus === "Prompting" ? "text" : delKind) === "file" ? (
                      <label className="form-field" style={{ margin: 0 }}>
                        <span>File</span>
                        <input ref={delFileInputRef} type="file" accept={DOC_ACCEPT} />
                      </label>
                    ) : (
                      <label className="form-field" style={{ margin: 0 }}>
                        <span>{currentStatus === "Prompting" ? "Prompt" : "Text"}</span>
                        <textarea
                          value={delText}
                          onChange={(event) => setDelText(event.target.value)}
                          rows={4}
                          placeholder={
                            currentStatus === "Prompting"
                              ? "The prompt(s) for this stage…"
                              : "Paste the deliverable text…"
                          }
                        />
                      </label>
                    )}

                    <button type="submit" className="issue-submit-btn" disabled={delSubmitting} style={{ marginTop: "4px" }}>
                      {delSubmitting ? "Submitting…" : "Submit deliverable"}
                    </button>
                  </form>
                ) : currentStatus === "Editing" ? (
                  <div style={{ marginTop: "12px" }}>
                    <div className="form-hint" style={{ marginBottom: "8px" }}>
                      Uploaded the final cut? Submit it for the Lead&apos;s review.
                    </div>
                    <button
                      type="button"
                      className="issue-submit-btn"
                      style={{ width: "100%" }}
                      disabled={delSubmittingReview}
                      onClick={handleVideoSubmitForReview}
                    >
                      {delSubmittingReview ? "Submitting…" : "Submit for review"}
                    </button>
                  </div>
                ) : (
                  <div className="issue-empty" style={{ marginTop: "12px" }}>
                    {currentStatus === "In Review"
                      ? "Awaiting Lead's review — nothing to submit."
                      : currentStatus === "Published"
                        ? "Published — no deliverables required."
                        : "No deliverable required at this stage."}
                  </div>
                )}
              </div>
            )}
        </div>
      </div>
    </div>
  </div>,
  document.body,
);
}
