"use client";

import { useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { REVIEW_STATUS_ORDER } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import { useMounted } from "@/lib/useMounted";
import type { Product } from "@/lib/types";

interface ProductReviewModalProps {
  product: Product;
  onClose: () => void;
}

export function ProductReviewModal({ product, onClose }: ProductReviewModalProps) {
  const mounted = useMounted();

  const [reviewStatus, setReviewStatus] = useState(
    product.reviewStatus ?? "Not Started",
  );
  const [rejectionReason, setRejectionReason] = useState(
    product.rejectionReason ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const item = product.items[0];
  const isRejecting = reviewStatus === "Rejected";
  const isAccepting = reviewStatus === "Accepted";

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isRejecting && !rejectionReason.trim()) {
      setError("A reason is required when rejecting.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    // Accepting is what advances the pipeline stage to Scheduled — there's
    // no separate "schedule this" step. enforce_product_update_permissions
    // only lets approvers move status to exactly 'Scheduled', so this is
    // the one and only stage change this modal is allowed to make.
    const { error: saveError } = await supabase
      .from("products")
      .update({
        review_status: reviewStatus,
        rejection_reason: isRejecting ? rejectionReason.trim() : null,
        ...(isAccepting ? { status: "Scheduled" } : {}),
      })
      .eq("id", product.id);

    setSubmitting(false);
    if (saveError) {
      setError(saveError.message);
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
          <span>Stage: {item.status}</span>
          {item.videoUrl ? (
            <>
              <span className="video-modal-meta-sep"> • </span>
              <a href={item.videoUrl} target="_blank" rel="noopener noreferrer">
                Open video
              </a>
            </>
          ) : null}
        </div>

        <form className="form-grid" onSubmit={handleSubmit} style={{ marginTop: "16px" }}>
          {error ? <div className="callout form-error">{error}</div> : null}

          <label className="form-field form-field-wide">
            <span>Review status</span>
            <select
              value={reviewStatus}
              onChange={(event) => setReviewStatus(event.target.value)}
            >
              {REVIEW_STATUS_ORDER.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            {isAccepting ? (
              <span className="form-hint">
                Accepting moves the stage to Scheduled.
              </span>
            ) : null}
          </label>

          {isRejecting ? (
            <label className="form-field form-field-wide">
              <span>Reason for rejection</span>
              <textarea
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                rows={4}
                placeholder="What needs to change before this can be accepted?"
                required
              />
            </label>
          ) : null}

          <div className="form-actions">
            <span />
            <button
              type="submit"
              className="issue-submit-btn"
              disabled={submitting}
            >
              {submitting ? "Saving…" : "Save review"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
