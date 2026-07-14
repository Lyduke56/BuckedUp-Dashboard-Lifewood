"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { useMounted } from "@/lib/useMounted";
import {
  DELIVERABLE_STAGES,
  type DeliverableStage,
  type Product,
  type StageDeliverable,
} from "@/lib/types";

interface ProductReviewModalProps {
  product: Product;
  currentDeliverable: StageDeliverable | null;
  onClose: () => void;
}

function isDeliverableStage(status: string): status is DeliverableStage {
  return (DELIVERABLE_STAGES as string[]).includes(status);
}

// Lead-facing review modal, reused at every stage that has something to
// review. The three document/text stages review a stage_deliverables row
// via review_stage_deliverable() (accept advances to the next stage). The
// Editing/In Review video leg keeps the older products.review_status /
// rejection_reason shape (accept -> Published, reject -> back to Editing).
export function ProductReviewModal({
  product,
  currentDeliverable,
  onClose,
}: ProductReviewModalProps) {
  const mounted = useMounted();
  const status = product.items[0].status;
  const item = product.items[0];

  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isDocStage = isDeliverableStage(status);
  const isVideoStage = status === "Editing" || status === "In Review";

  const reviewDoc = async (decision: "accepted" | "rejected") => {
    if (!currentDeliverable) return;
    if (decision === "rejected" && !note.trim()) {
      setError("A note is required when rejecting.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcErr } = await supabase.rpc("review_stage_deliverable", {
      p_deliverable_id: currentDeliverable.id,
      p_decision: decision,
      p_note: note.trim() || null,
    });
    setSubmitting(false);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    onClose();
  };

  const reviewVideo = async (decision: "accepted" | "rejected") => {
    if (decision === "rejected" && !note.trim()) {
      setError("A note is required when rejecting.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { error: saveErr } = await supabase
      .from("products")
      .update(
        decision === "accepted"
          ? { review_status: "Accepted", rejection_reason: null, status: "Published" }
          : { review_status: "Rejected", rejection_reason: note.trim(), status: "Editing" },
      )
      .eq("id", product.id);
    setSubmitting(false);
    if (saveErr) {
      setError(saveErr.message);
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
        <div className="video-modal-title">Review — {product.name}</div>
        <div className="video-modal-meta">
          <span>Stage: {status}</span>
        </div>

        {error ? (
          <div className="callout form-error" style={{ marginTop: "16px" }}>
            {error}
          </div>
        ) : null}

        {isDocStage ? (
          currentDeliverable ? (
            <div className="form-grid" style={{ marginTop: "16px" }}>
              <div className="form-field form-field-wide">
                <span>Submitted {currentDeliverable.kind}</span>
                {currentDeliverable.kind === "file" && currentDeliverable.fileUrl ? (
                  <a
                    href={currentDeliverable.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open submitted document
                  </a>
                ) : (
                  <div
                    className="callout"
                    style={{ whiteSpace: "pre-wrap", maxHeight: "240px", overflowY: "auto" }}
                  >
                    {currentDeliverable.textContent}
                  </div>
                )}
              </div>

              <label className="form-field form-field-wide">
                <span>Note (required to reject)</span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  placeholder="What needs to change? (leave blank to accept)"
                />
              </label>

              <div className="form-actions">
                <button
                  type="button"
                  className="delete-btn"
                  disabled={submitting}
                  onClick={() => reviewDoc("rejected")}
                >
                  {submitting ? "Saving…" : "Reject"}
                </button>
                <button
                  type="button"
                  className="issue-submit-btn"
                  disabled={submitting}
                  onClick={() => reviewDoc("accepted")}
                >
                  {submitting ? "Saving…" : "Accept & advance"}
                </button>
              </div>
            </div>
          ) : (
            <div className="empty-state" style={{ marginTop: "16px" }}>
              Nothing submitted for this stage yet — waiting on the Operator.
            </div>
          )
        ) : isVideoStage ? (
          <div className="form-grid" style={{ marginTop: "16px" }}>
            <div className="form-field form-field-wide">
              <span>Video</span>
              {item.videoUrl ? (
                <a href={item.videoUrl} target="_blank" rel="noopener noreferrer">
                  Open video
                </a>
              ) : (
                <span className="form-hint">No video uploaded yet.</span>
              )}
            </div>

            <label className="form-field form-field-wide">
              <span>Note (required to reject)</span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                placeholder="What needs to change? (leave blank to accept)"
              />
            </label>

            <div className="form-actions">
              <button
                type="button"
                className="delete-btn"
                disabled={submitting}
                onClick={() => reviewVideo("rejected")}
              >
                {submitting ? "Saving…" : "Reject to Editing"}
              </button>
              <button
                type="button"
                className="issue-submit-btn"
                disabled={submitting}
                onClick={() => reviewVideo("accepted")}
              >
                {submitting ? "Saving…" : "Accept & publish"}
              </button>
            </div>
          </div>
        ) : (
          <div className="empty-state" style={{ marginTop: "16px" }}>
            {status === "Published"
              ? "This item is already published."
              : "Nothing to review at this stage."}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
