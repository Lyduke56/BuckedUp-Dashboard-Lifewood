"use client";

import { useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { useMounted } from "@/lib/useMounted";
import {
  type DeliverableKind,
  type DeliverableStage,
  type Product,
  type StageDeliverable,
} from "@/lib/types";
import { VideoVersionsPanel } from "@/components/organisms/VideoVersionsPanel";
import { useStageDeliverables } from "@/lib/useStageDeliverables";

interface ProductionModalProps {
  product: Product;
  onClose: () => void;
}

const DOC_ACCEPT =
  ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function ProductionModal({
  product,
  onClose,
}: ProductionModalProps) {
  const mounted = useMounted();
  const { currentByKey } = useStageDeliverables();
  const status = product.items[0].status;

  // Tabs for the Design stage: toggle between Storyboarding and Scripting deliverables
  const [activeSubStage, setActiveSubStage] = useState<"Storyboarding" | "Scripting">("Storyboarding");

  // Input states for Design stage deliverables submission
  const [kind, setKind] = useState<DeliverableKind>("file");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Retrieve current active deliverable based on selected Design sub-stage
  const currentDeliverable = currentByKey.get(`${product.id}:${activeSubStage}`) ?? null;

  const submitDoc = async (event: FormEvent) => {
    event.preventDefault();
    if (status !== "Design") return;

    const file = fileInputRef.current?.files?.[0] ?? null;

    if (kind === "file" && !file) {
      setError("Choose a file to upload.");
      return;
    }
    if (kind === "text" && !text.trim()) {
      setError("Enter the deliverable text.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? null;

    let fileUrl: string | null = null;
    if (kind === "file" && file) {
      const path = `${product.id}/${activeSubStage}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("stage-documents")
        .upload(path, file, { contentType: file.type });
      if (upErr) {
        setSubmitting(false);
        setError(upErr.message);
        return;
      }
      fileUrl = supabase.storage.from("stage-documents").getPublicUrl(path).data
        .publicUrl;
    }

    const { error: insErr } = await supabase.from("stage_deliverables").insert({
      product_id: product.id,
      stage: activeSubStage,
      kind: kind,
      file_url: fileUrl,
      text_content: kind === "text" ? text.trim() : null,
      submitted_by: uid,
    });

    setSubmitting(false);
    if (insErr) {
      setError(insErr.message);
      return;
    }

    // Reset input fields
    setText("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const submitVideoForReview = async () => {
    setSubmittingReview(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcErr } = await supabase.rpc("submit_video_for_review", {
      p_product_id: product.id,
    });
    setSubmittingReview(false);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    onClose();
  };

  if (!mounted) return null;

  const hasVideo = !!product.items[0].videoUrl;

  const decisionBanner = currentDeliverable ? (
    <div
      className="callout"
      style={{
        gridColumn: "1 / -1",
        borderLeftColor:
          currentDeliverable.decision === "rejected"
            ? "#dc3545"
            : currentDeliverable.decision === "accepted"
              ? "var(--castleton)"
              : "var(--saffron)",
      }}
    >
      Current {activeSubStage} submission: <strong>{currentDeliverable.decision}</strong>
      {currentDeliverable.decision === "rejected" && currentDeliverable.decisionNote
        ? ` — ${currentDeliverable.decisionNote}`
        : null}
    </div>
  ) : null;

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
        <div className="video-modal-title">Submit deliverable — {product.name}</div>
        <div className="video-modal-meta">
          <span>Stage: {status}</span>
        </div>

        {status === "Design" ? (
          <div style={{ marginTop: "16px" }}>
            {/* Design stage sub-tabs */}
            <div className="flex gap-2 border-b border-[var(--glass-border)] pb-2 mb-4">
              <button
                type="button"
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                  activeSubStage === "Storyboarding"
                    ? "bg-[var(--saffron)] text-[var(--ink-dark)]"
                    : "text-[var(--ink-soft)] hover:bg-[var(--glass-hover)]"
                }`}
                onClick={() => {
                  setActiveSubStage("Storyboarding");
                  setError(null);
                }}
              >
                Storyboard
              </button>
              <button
                type="button"
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                  activeSubStage === "Scripting"
                    ? "bg-[var(--saffron)] text-[var(--ink-dark)]"
                    : "text-[var(--ink-soft)] hover:bg-[var(--glass-hover)]"
                }`}
                onClick={() => {
                  setActiveSubStage("Scripting");
                  setError(null);
                }}
              >
                Script
              </button>
            </div>

            <form className="form-grid" onSubmit={submitDoc}>
              {error ? <div className="callout form-error">{error}</div> : null}
              {decisionBanner}

              <label className="form-field form-field-wide">
                <span>Deliverable type</span>
                <select
                  value={kind}
                  onChange={(event) => setKind(event.target.value as DeliverableKind)}
                >
                  <option value="file">File (PDF or DOCX)</option>
                  <option value="text">Text</option>
                </select>
              </label>

              {kind === "file" ? (
                <label className="form-field form-field-wide">
                  <span>File</span>
                  <input ref={fileInputRef} type="file" accept={DOC_ACCEPT} />
                </label>
              ) : (
                <label className="form-field form-field-wide">
                  <span>Text Content</span>
                  <textarea
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    rows={6}
                    placeholder={`Paste the ${activeSubStage.toLowerCase()} text…`}
                  />
                </label>
              )}

              <div className="form-actions">
                <span />
                <button type="submit" className="issue-submit-btn" disabled={submitting}>
                  {submitting ? "Submitting…" : `Submit ${activeSubStage === "Storyboarding" ? "Storyboard" : "Script"}`}
                </button>
              </div>
            </form>
          </div>
        ) : status === "Production" ? (
          <>
            {error ? (
              <div className="callout form-error" style={{ marginTop: "16px" }}>
                {error}
              </div>
            ) : null}
            <VideoVersionsPanel productId={product.id} onVersionAdded={() => {}} />
            <div className="form-actions" style={{ marginTop: "16px" }}>
              <span className="form-hint">
                {hasVideo
                  ? "Are you satisfied with your uploaded video? Submit it to the Lead for final review."
                  : "Upload a video cut above to enable submission."}
              </span>
              <button
                type="button"
                className="issue-submit-btn"
                disabled={submittingReview || !hasVideo}
                onClick={submitVideoForReview}
              >
                {submittingReview ? "Submitting…" : "Submit for review"}
              </button>
            </div>
          </>
        ) : (
          <div className="empty-state" style={{ marginTop: "16px" }}>
            {status === "In Review"
              ? "This item is awaiting the Lead's review — nothing to submit right now."
              : status === "Published"
                ? "This item is published — nothing left to submit."
                : "No deliverable is required at this stage yet."}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
