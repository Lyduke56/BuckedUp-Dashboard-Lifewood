"use client";

import { useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { useMounted } from "@/lib/useMounted";
import {
  DELIVERABLE_STAGES,
  type DeliverableKind,
  type DeliverableStage,
  type Product,
  type StageDeliverable,
} from "@/lib/types";
import { VideoVersionsPanel } from "@/components/organisms/VideoVersionsPanel";

interface ProductionModalProps {
  product: Product;
  currentDeliverable: StageDeliverable | null;
  onClose: () => void;
}

const DOC_ACCEPT =
  ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function isDeliverableStage(status: string): status is DeliverableStage {
  return (DELIVERABLE_STAGES as string[]).includes(status);
}

// Operator-facing "submit deliverable" modal. Branches on the product's
// current stage: the three document/text stages write a stage_deliverables
// row; the Editing stage uploads a video version and can submit it for
// review. Operators never move the stage directly — advancement happens
// when a Lead accepts (doc stages) or via submit_video_for_review (video).
export function ProductionModal({
  product,
  currentDeliverable,
  onClose,
}: ProductionModalProps) {
  const mounted = useMounted();
  const status = product.items[0].status;

  // Prompting is text-only; Storyboarding/Scripting allow either.
  const [kind, setKind] = useState<DeliverableKind>(
    status === "Prompting" ? "text" : "file",
  );
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const submitDoc = async (event: FormEvent) => {
    event.preventDefault();
    if (!isDeliverableStage(status)) return;

    const effectiveKind = status === "Prompting" ? "text" : kind;
    const file = fileInputRef.current?.files?.[0] ?? null;

    if (effectiveKind === "file" && !file) {
      setError("Choose a file to upload.");
      return;
    }
    if (effectiveKind === "text" && !text.trim()) {
      setError("Enter the deliverable text.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? null;

    let fileUrl: string | null = null;
    if (effectiveKind === "file" && file) {
      const path = `${product.id}/${status}/${Date.now()}-${file.name}`;
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
      stage: status,
      kind: effectiveKind,
      file_url: fileUrl,
      text_content: effectiveKind === "text" ? text.trim() : null,
      submitted_by: uid,
    });

    setSubmitting(false);
    if (insErr) {
      setError(insErr.message);
      return;
    }
    onClose();
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

  const decisionBanner =
    currentDeliverable && isDeliverableStage(status) ? (
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
        Current submission: <strong>{currentDeliverable.decision}</strong>
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

        {isDeliverableStage(status) ? (
          <form className="form-grid" onSubmit={submitDoc} style={{ marginTop: "16px" }}>
            {error ? <div className="callout form-error">{error}</div> : null}
            {decisionBanner}

            {status === "Prompting" ? null : (
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
            )}

            {(status === "Prompting" ? "text" : kind) === "file" ? (
              <label className="form-field form-field-wide">
                <span>File</span>
                <input ref={fileInputRef} type="file" accept={DOC_ACCEPT} />
              </label>
            ) : (
              <label className="form-field form-field-wide">
                <span>{status === "Prompting" ? "Prompt" : "Text"}</span>
                <textarea
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  rows={6}
                  placeholder={
                    status === "Prompting"
                      ? "The prompt(s) for this stage…"
                      : "Paste the deliverable text…"
                  }
                />
              </label>
            )}

            <div className="form-actions">
              <span />
              <button type="submit" className="issue-submit-btn" disabled={submitting}>
                {submitting ? "Submitting…" : "Submit deliverable"}
              </button>
            </div>
          </form>
        ) : status === "Editing" ? (
          <>
            {error ? (
              <div className="callout form-error" style={{ marginTop: "16px" }}>
                {error}
              </div>
            ) : null}
            <VideoVersionsPanel productId={product.id} onVersionAdded={() => {}} />
            <div className="form-actions" style={{ marginTop: "16px" }}>
              <span className="form-hint">
                Uploaded the final cut? Submit it for the Lead&apos;s review.
              </span>
              <button
                type="button"
                className="issue-submit-btn"
                disabled={submittingReview}
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
