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

  // Tab state for Design stage: toggle between Storyboarding and Scripting
  const [activeSubStage, setActiveSubStage] = useState<"Storyboarding" | "Scripting">("Storyboarding");

  const [error, setError] = useState<string | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);

  // Track if a video exists reactively so uploaded videos immediately enable submission
  const [hasVideo, setHasVideo] = useState(!!product.items[0].videoUrl);

  // Retrieve current active deliverables for Design stage
  const storyboardDel = currentByKey.get(`${product.id}:Storyboarding`) ?? null;
  const scriptDel = currentByKey.get(`${product.id}:Scripting`) ?? null;

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

  return createPortal(
    <div
      className="overlay show"
      style={{ overflowY: "auto", padding: "20px 12px" }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div className="modal form-modal" style={{ maxHeight: "85vh", overflowY: "auto" }}>
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
                onClick={() => setActiveSubStage("Storyboarding")}
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
                onClick={() => setActiveSubStage("Scripting")}
              >
                Script
              </button>
            </div>

            {/* Both portals stay mounted so state (file/text choice, input values) is preserved across tabs */}
            <div style={{ display: activeSubStage === "Storyboarding" ? "block" : "none" }}>
              <DeliverableSubmissionPortal
                title="Storyboard Deliverable"
                subStage="Storyboarding"
                deliverable={storyboardDel}
                productId={product.id}
                isAnySubmitted={!!storyboardDel || !!scriptDel}
              />
            </div>

            <div style={{ display: activeSubStage === "Scripting" ? "block" : "none" }}>
              <DeliverableSubmissionPortal
                title="Script Deliverable"
                subStage="Scripting"
                deliverable={scriptDel}
                productId={product.id}
                isAnySubmitted={!!storyboardDel || !!scriptDel}
              />
            </div>
          </div>
        ) : status === "Production" ? (
          <>
            {error ? (
              <div className="callout form-error" style={{ marginTop: "16px" }}>
                {error}
              </div>
            ) : null}
            <VideoVersionsPanel
              productId={product.id}
              onVersionAdded={(url) => setHasVideo(!!url)}
            />
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

function DeliverableSubmissionPortal({
  title,
  subStage,
  deliverable,
  productId,
  isAnySubmitted,
}: {
  title: string;
  subStage: "Storyboarding" | "Scripting";
  deliverable: StageDeliverable | null;
  productId: string;
  isAnySubmitted?: boolean;
}) {
  const [kind, setKind] = useState<DeliverableKind>("file");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
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
      const path = `${productId}/${subStage}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("stage-documents")
        .upload(path, file, { contentType: file.type });
      if (upErr) {
        setSubmitting(false);
        setError(upErr.message);
        return;
      }
      fileUrl = supabase.storage.from("stage-documents").getPublicUrl(path).data.publicUrl;
    }

    const { error: insErr } = await supabase.from("stage_deliverables").insert({
      product_id: productId,
      stage: subStage,
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

    setText("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const decisionColor =
    deliverable?.decision === "rejected"
      ? "#dc3545"
      : deliverable?.decision === "accepted"
      ? "var(--castleton)"
      : "var(--saffron)";

  return (
    <div>
      <div className="font-bold text-sm mb-2 text-primary">{title}</div>
      {deliverable ? (
        <div
          className="callout text-xs mb-3"
          style={{ borderLeftColor: decisionColor }}
        >
          <div>
            Current submission status: <strong>{deliverable.decision}</strong>
            {deliverable.decision === "rejected" && deliverable.decisionNote
              ? ` — ${deliverable.decisionNote}`
              : null}
          </div>
          {deliverable.kind === "file" && deliverable.fileUrl ? (
            <div className="mt-1">
              <a
                href={deliverable.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-current underline font-semibold"
              >
                Open submitted document
              </a>
            </div>
          ) : deliverable.textContent ? (
            <div className="mt-1 font-mono text-[11px] opacity-90 max-h-20 overflow-y-auto whitespace-pre-wrap">
              {deliverable.textContent}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="empty-state text-xs py-2 mb-3">
          No deliverable submitted yet.
        </div>
      )}

      <form className="form-grid" onSubmit={handleSubmit}>
        {error ? <div className="callout form-error mb-2">{error}</div> : null}

        <label className="form-field form-field-wide">
          <span>Submission Type</span>
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
              rows={5}
              placeholder={`Paste the ${subStage === "Storyboarding" ? "storyboard" : "script"} text…`}
            />
          </label>
        )}

        <div className="form-actions">
          {isAnySubmitted && !deliverable ? (
            <span className="form-hint" style={{ color: "var(--saffron)" }}>
              A deliverable has already been submitted for this stage.
            </span>
          ) : (
            <span />
          )}
          <button type="submit" className="issue-submit-btn" disabled={submitting || isAnySubmitted}>
            {submitting ? "Submitting…" : `Submit ${subStage === "Storyboarding" ? "Storyboard" : "Script"}`}
          </button>
        </div>
      </form>
    </div>
  );
}


