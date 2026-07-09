"use client";

import { useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { STATUS_ORDER } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import { useMounted } from "@/lib/useMounted";
import type { PipelineStatus, Product } from "@/lib/types";
import { VideoVersionsPanel } from "./VideoVersionsPanel";

interface ProductionModalProps {
  product: Product;
  onClose: () => void;
}

// Editor-scoped: stage and video versions only. Everything else about a
// product (name, category, owner, dates, ...) is an admin job — see
// enforce_product_update_permissions() in supabase/schema.sql, which
// blocks editors from touching those columns even if this UI didn't.
export function ProductionModal({ product, onClose }: ProductionModalProps) {
  const mounted = useMounted();

  const [status, setStatus] = useState<PipelineStatus>(product.items[0].status);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error: saveError } = await supabase
      .from("products")
      .update({ status })
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
        <div className="video-modal-title">Production — {product.name}</div>

        <form className="form-grid" onSubmit={handleSubmit} style={{ marginTop: "16px" }}>
          {error ? <div className="callout form-error">{error}</div> : null}

          <label className="form-field form-field-wide">
            <span>Stage</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as PipelineStatus)}
            >
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <div className="form-actions">
            <span />
            <button type="submit" className="issue-submit-btn" disabled={submitting}>
              {submitting ? "Saving…" : "Save stage"}
            </button>
          </div>
        </form>

        <VideoVersionsPanel productId={product.id} onVersionAdded={() => {}} />
      </div>
    </div>,
    document.body,
  );
}
