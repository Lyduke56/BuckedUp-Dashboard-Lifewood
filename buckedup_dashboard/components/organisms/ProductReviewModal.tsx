"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { useMounted } from "@/lib/useMounted";
import { type Product, type StageDeliverable } from "@/lib/types";
import { useStageDeliverables } from "@/lib/useStageDeliverables";

interface ProductReviewModalProps {
  product: Product;
  onClose: () => void;
}

export function ProductReviewModal({
  product,
  onClose,
}: ProductReviewModalProps) {
  const mounted = useMounted();
  const { currentByKey } = useStageDeliverables();
  const status = product.items[0].status;
  const item = product.items[0];

  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Retrieve Design stage deliverables
  const storyboardDel = currentByKey.get(`${product.id}:Storyboarding`) ?? null;
  const scriptDel = currentByKey.get(`${product.id}:Scripting`) ?? null;

  // Individual decisions for Design stage
  const [storyboardDecision, setStoryboardDecision] = useState<"accepted" | "rejected" | "pending">(
    storyboardDel ? storyboardDel.decision : "pending"
  );
  const [scriptDecision, setScriptDecision] = useState<"accepted" | "rejected" | "pending">(
    scriptDel ? scriptDel.decision : "pending"
  );

  const reviewDesign = async () => {
    const hasRejections = storyboardDecision === "rejected" || scriptDecision === "rejected";
    if (hasRejections && !note.trim()) {
      setError("A note is required when rejecting deliverables.");
      return;
    }

    setSubmitting(true);
    setError(null);
    const supabase = createClient();

    try {
      if (storyboardDel && storyboardDecision !== storyboardDel.decision) {
        const { error: rpcErr } = await supabase.rpc("review_stage_deliverable", {
          p_deliverable_id: storyboardDel.id,
          p_decision: storyboardDecision === "pending" ? "rejected" : storyboardDecision, // Fallback if pending
          p_note: note.trim() || null,
        });
        if (rpcErr) throw new Error(rpcErr.message);
      }

      if (scriptDel && scriptDecision !== scriptDel.decision) {
        const { error: rpcErr } = await supabase.rpc("review_stage_deliverable", {
          p_deliverable_id: scriptDel.id,
          p_decision: scriptDecision === "pending" ? "rejected" : scriptDecision, // Fallback if pending
          p_note: note.trim() || null,
        });
        if (rpcErr) throw new Error(rpcErr.message);
      }

      setSubmitting(false);
      onClose();
    } catch (err: any) {
      setSubmitting(false);
      setError(err.message || "An error occurred while saving the review.");
    }
  };

  const reviewVideo = async (decision: "accepted" | "rejected") => {
    if (decision === "accepted" && !item.videoUrl) {
      setError("Cannot publish without a video uploaded.");
      return;
    }
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
          : { review_status: "Rejected", rejection_reason: note.trim(), status: "Production" },
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

        {status === "Design" ? (
          <div className="form-grid" style={{ marginTop: "16px" }}>
            {/* Storyboard Deliverable Section */}
            <div className="form-field form-field-wide border-b border-[var(--glass-border)] pb-4 mb-2">
              <span className="font-bold block mb-1">1. Storyboard Deliverable</span>
              {storyboardDel ? (
                <div className="flex flex-col gap-2">
                  {storyboardDel.kind === "file" && storyboardDel.fileUrl ? (
                    <a
                      href={storyboardDel.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--saffron)] underline text-xs font-semibold"
                    >
                      Open submitted storyboard document
                    </a>
                  ) : (
                    <div
                      className="callout text-xs"
                      style={{ whiteSpace: "pre-wrap", maxHeight: "120px", overflowY: "auto" }}
                    >
                      {storyboardDel.textContent}
                    </div>
                  )}
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-xs">Decision:</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className={`px-3 py-1 text-xs rounded transition-all ${storyboardDecision === "accepted"
                            ? "bg-[var(--castleton)] text-white"
                            : "bg-[var(--glass-bg)] hover:bg-[var(--glass-hover)]"
                          }`}
                        onClick={() => setStoryboardDecision("accepted")}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className={`px-3 py-1 text-xs rounded transition-all ${storyboardDecision === "rejected"
                            ? "bg-red-500 text-white"
                            : "bg-[var(--glass-bg)] hover:bg-[var(--glass-hover)]"
                          }`}
                        onClick={() => setStoryboardDecision("rejected")}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="empty-state text-xs py-2">
                  No storyboard submitted yet.
                </div>
              )}
            </div>

            {/* Script Deliverable Section */}
            <div className="form-field form-field-wide border-b border-[var(--glass-border)] pb-4 mb-2">
              <span className="font-bold block mb-1">2. Script Deliverable</span>
              {scriptDel ? (
                <div className="flex flex-col gap-2">
                  {scriptDel.kind === "file" && scriptDel.fileUrl ? (
                    <a
                      href={scriptDel.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--saffron)] underline text-xs font-semibold"
                    >
                      Open submitted script document
                    </a>
                  ) : (
                    <div
                      className="callout text-xs"
                      style={{ whiteSpace: "pre-wrap", maxHeight: "120px", overflowY: "auto" }}
                    >
                      {scriptDel.textContent}
                    </div>
                  )}
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-xs">Decision:</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className={`px-3 py-1 text-xs rounded transition-all ${scriptDecision === "accepted"
                            ? "bg-[var(--castleton)] text-white"
                            : "bg-[var(--glass-bg)] hover:bg-[var(--glass-hover)]"
                          }`}
                        onClick={() => setScriptDecision("accepted")}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className={`px-3 py-1 text-xs rounded transition-all ${scriptDecision === "rejected"
                            ? "bg-red-500 text-white"
                            : "bg-[var(--glass-bg)] hover:bg-[var(--glass-hover)]"
                          }`}
                        onClick={() => setScriptDecision("rejected")}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="empty-state text-xs py-2">
                  No script submitted yet.
                </div>
              )}
            </div>

            <label className="form-field form-field-wide">
              <span>Note (required to reject either)</span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                placeholder="Feedback/rejection reason..."
              />
            </label>

            <div className="form-actions">
              <span />
              <button
                type="button"
                className="issue-submit-btn"
                disabled={submitting || (!storyboardDel && !scriptDel)}
                onClick={reviewDesign}
              >
                {submitting ? "Saving…" : "Save Review"}
              </button>
            </div>
          </div>
        ) : status === "In Review" ? (
          <div className="form-grid" style={{ marginTop: "16px" }}>
            <div className="form-field form-field-wide border-b border-[var(--glass-border)] pb-4 mb-2">
              <span className="font-bold block mb-1">Video Output</span>
              {item.videoUrl ? (
                <a
                  href={item.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--saffron)] underline text-xs font-semibold"
                >
                  Open submitted video file
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
                {submitting ? "Saving…" : "Reject to Production"}
              </button>
              <button
                type="button"
                className="issue-submit-btn"
                disabled={submitting || !item.videoUrl}
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
