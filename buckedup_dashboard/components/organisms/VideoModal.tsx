"use client";

import { createPortal } from "react-dom";
import { useMounted } from "@/lib/useMounted";
import { STATUS_HEX } from "@/lib/data";
import { useAuth } from "@/lib/useAuth";
import type { PipelineStatus, Product, CatalogProduct } from "@/lib/types";
import { parseDriveFileId, parseModalKey } from "@/lib/utils";
import { PlayCircleIcon, VideoCameraIcon } from "@/components/atoms/icons";
import { useFeedback } from "@/lib/useFeedback";
import { Send } from "lucide-react";
import { useState } from "react";

interface VideoModalProps {
  products: Product[];
  catalog: CatalogProduct[];
  modalKey: string | null;
  onClose: () => void;
}

function languageFlag(lang: string | null | undefined): string {
  if (!lang) return "🌐";
  const normalized = lang.toLowerCase().trim();
  if (normalized.includes("english")) return "🇺🇸";
  if (normalized.includes("spanish")) return "🇪🇸";
  if (normalized.includes("german")) return "🇩🇪";
  if (normalized.includes("french")) return "🇫🇷";
  if (normalized.includes("italian")) return "🇮🇹";
  if (normalized.includes("japanese")) return "🇯🇵";
  if (normalized.includes("chinese")) return "🇨🇳";
  return "🌐";
}

// Parses YouTube ID from standard formats
function getYoutubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(ytRegex);
  return match && match[1] ? match[1] : null;
}

// Check if URL points directly to a video file extension
function isDirectVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /\.(mp4|webm|ogg|mov)(?:\?|$)/i.test(url);
}

const REACTION_OPTIONS: { id: import("@/lib/types").FeedbackReaction; emoji: string; label: string }[] = [
  { id: "loved", emoji: "🔥", label: "Loved it" },
  { id: "good", emoji: "👍", label: "Good" },
  { id: "neutral", emoji: "😐", label: "Neutral" },
  { id: "needs_work", emoji: "👎", label: "Needs Revision" },
  { id: "unsatisfied", emoji: "❌", label: "Unsatisfied" },
];

const REACTION_MAP: Record<string, { emoji: string; label: string }> = {
  loved: { emoji: "🔥", label: "Loved it" },
  good: { emoji: "👍", label: "Good" },
  neutral: { emoji: "😐", label: "Neutral" },
  needs_work: { emoji: "👎", label: "Needs Revision" },
  unsatisfied: { emoji: "❌", label: "Unsatisfied" },
};

export function VideoModal({ products, catalog, modalKey, onClose }: VideoModalProps) {
  const mounted = useMounted();
  const { role } = useAuth();
  const [feedbackText, setFeedbackText] = useState("");
  const [selectedReaction, setSelectedReaction] = useState<import("@/lib/types").FeedbackReaction | null>(null);

  const { rank, index } = parseModalKey(modalKey ?? "");
  const product = products.find((p) => p.rank === rank);
  const item = product?.items[index ?? 0];
  const { feedbackList, addFeedback } = useFeedback(product?.id);

  if (!modalKey) return null;
  if (!mounted) return null;
  if (!product || !item) return null;

  const catalogProduct = catalog.find(c => c.id === product.catalogProductId);

  const videoUrl = item.videoUrl;
  const driveFileId = videoUrl ? parseDriveFileId(videoUrl) : null;
  const youtubeId = videoUrl ? getYoutubeId(videoUrl) : null;
  const isDirect = videoUrl ? isDirectVideoUrl(videoUrl) : false;
  const statusColor = STATUS_HEX[item.status as PipelineStatus] ?? "var(--castleton)";

  const canInteract = role !== "operator";

  const handleSendFeedback = () => {
    if (!canInteract) return;
    if (!feedbackText.trim() && !selectedReaction) return;
    const textToSend = feedbackText.trim() || (selectedReaction ? `[Reaction: ${REACTION_MAP[selectedReaction]?.label ?? selectedReaction}]` : "");
    addFeedback(product.id, textToSend, selectedReaction);
    setFeedbackText("");
    setSelectedReaction(null);
  };

  return createPortal(
    <div
      className="overlay show"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
      role="presentation"
    >
      <div className="modal video-modal-wide">
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close modal">
          ✕
        </button>

        <div className="video-modal-grid">
          {/* LEFT COLUMN: Dedicated Product & Queue Details */}
          <div className="video-details-left">
            <div>
              <div className="video-modal-title" style={{ fontSize: "22px", fontWeight: 800, marginBottom: "4px" }}>
                {product.name}
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "12px", alignItems: "center" }}>
                <span
                  style={{
                    display: "inline-block",
                    padding: "4px 10px",
                    borderRadius: "8px",
                    fontSize: "11px",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    backgroundColor: statusColor + "15",
                    color: statusColor,
                    border: `1.5px solid ${statusColor}40`,
                  }}
                >
                  {item.status}
                </span>
                <span className="language-badge" style={{ margin: 0 }}>
                  {languageFlag(product.language)} {product.language}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "10px" }}>
              <div className="detail-label-group">
                <span className="detail-label">Rank / Queue ID</span>
                <span className="detail-value" style={{ fontFamily: "monospace", fontSize: "15px" }}>#{product.rank}</span>
              </div>

              <div className="detail-label-group">
                <span className="detail-label">Category & Subcategory</span>
                <span className="detail-value">
                  {product.category} <span style={{ color: "var(--ink-soft)", fontWeight: 500 }}>➔</span> {product.subcategory}
                </span>
              </div>

              {product.type && (
                <div className="detail-label-group">
                  <span className="detail-label">Content Type</span>
                  <span className="detail-value">{product.type}</span>
                </div>
              )}

              {catalogProduct && (
                <div className="detail-label-group" style={{ background: "var(--surface)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                  <span className="detail-label">Catalog Item</span>
                  <span className="detail-value" style={{ fontWeight: 800, color: "var(--castleton)" }}>{catalogProduct.name}</span>
                  <div style={{ fontSize: "12px", color: "var(--ink-soft)", marginTop: "4px" }}>
                    Variants: {catalogProduct.variantCount > 0 ? catalogProduct.variants.join(", ") : "N/A"}
                  </div>
                </div>
              )}

              <div className="detail-label-group">
                <span className="detail-label">Owner</span>
                <span className="detail-value">{product.owner ?? "Unassigned"}</span>
              </div>

              {product.publishDate && (
                <div className="detail-label-group">
                  <span className="detail-label">Target Publish Date</span>
                  <span className="detail-value">{product.publishDate}</span>
                </div>
              )}

              {product.contentAngle && (
                <div className="detail-label-group">
                  <span className="detail-label">Content Angle / Description</span>
                  <span className="detail-value" style={{ lineHeight: 1.6, fontSize: "13px", fontWeight: 500 }}>
                    {product.contentAngle}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Dedicated Video & Preview Player details */}
          <div className="video-details-right" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <span className="detail-label" style={{ marginBottom: "6px" }}>Video Preview & Player</span>

              {videoUrl ? (
                <>
                  {/* 1. Google Drive preview embed */}
                  {driveFileId && (
                    <div className="video-preview-card">
                      <iframe
                        style={{ width: "100%", height: "100%", border: "none" }}
                        src={`https://drive.google.com/file/d/${driveFileId}/preview`}
                        allow="autoplay"
                        allowFullScreen
                      />
                    </div>
                  )}

                  {/* 2. YouTube embed */}
                  {youtubeId && !driveFileId && (
                    <div className="video-preview-card">
                      <iframe
                        style={{ width: "100%", height: "100%", border: "none" }}
                        src={`https://www.youtube.com/embed/${youtubeId}`}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  )}

                  {/* 3. Direct Video file playback */}
                  {isDirect && !driveFileId && !youtubeId && (
                    <div className="video-preview-card">
                      <video
                        style={{ width: "100%", height: "100%", objectFit: "contain" }}
                        src={videoUrl}
                        controls
                      />
                    </div>
                  )}

                  {/* 4. Fallback Thumbnail Preview (unknown URL type: Dropbox, general site, etc.) */}
                  {!driveFileId && !youtubeId && !isDirect && (
                    <a
                      href={videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="video-preview-card interactive"
                      style={{ textDecoration: "none" }}
                    >
                      <div className="video-preview-fallback">
                        <PlayCircleIcon />
                        <div className="video-fallback-title">Open Video Link</div>
                        <div className="video-fallback-sub">
                          Click to watch on external site: <br />
                          <span style={{ fontFamily: "monospace", color: "var(--castleton)", fontSize: "11px" }}>
                            {new URL(videoUrl).hostname}
                          </span>
                        </div>
                      </div>
                    </a>
                  )}

                  {/* Link to open in new tab */}
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px", gap: "12px" }}>
                    <a
                      href={videoUrl}
                      download
                      className="video-link"
                      style={{ fontSize: "13px", fontWeight: 700, color: "var(--brand)", textDecoration: "none" }}
                    >
                      ↓ Download
                    </a>
                    <a
                      href={videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="video-link"
                      style={{ fontSize: "13px", fontWeight: 700, color: "var(--castleton)", textDecoration: "none" }}
                    >
                      ↗ Open link in new tab
                    </a>
                  </div>
                </>
              ) : (
                /* EMPTY THUMBNAIL STATE: switches based on status pacing */
                <div className="video-preview-card" style={{ borderStyle: "dashed" }}>
                  <div className="video-preview-fallback">
                    <VideoCameraIcon />
                    <div className="video-fallback-title">Pending Video Upload</div>
                    <div className="video-fallback-sub">
                      Currently in <span style={{ color: statusColor, fontWeight: 700 }}>{item.status.toLowerCase()}</span>.
                      The editor will provide the Google Drive or video URL once this stage completes.
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* FEEDBACK SECTION */}
            <div style={{ background: "var(--surface)", borderRadius: "12px", border: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden", minHeight: "220px" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", background: "var(--surface-hover)", fontWeight: 700, fontSize: "14px", color: "var(--ink)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Feedback & Comments</span>
                {feedbackList.length > 0 ? (
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-soft)" }}>
                    {feedbackList.length} comment{feedbackList.length > 1 ? "s" : ""}
                  </span>
                ) : null}
              </div>

              <div style={{ padding: "16px", flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px", maxHeight: "280px" }}>
                {feedbackList.length === 0 ? (
                  <div style={{ textAlign: "center", color: "var(--ink-soft)", fontSize: "13px", padding: "20px 0" }}>No feedback yet.</div>
                ) : (
                  feedbackList.map(fb => (
                    <div key={fb.id} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--castleton)" }}>{fb.userEmail}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          {fb.reaction && REACTION_MAP[fb.reaction] ? (
                            <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "12px", background: "rgba(16, 185, 129, 0.12)", color: "var(--castleton)", border: "1px solid rgba(16, 185, 129, 0.25)", fontWeight: 700 }}>
                              {REACTION_MAP[fb.reaction].emoji} {REACTION_MAP[fb.reaction].label}
                            </span>
                          ) : null}
                          <span style={{ fontSize: "11px", color: "var(--ink-soft)" }}>{new Date(fb.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: "13px", color: "var(--ink)", background: "var(--surface-hover)", padding: "8px 12px", borderRadius: "0 8px 8px 8px" }}>
                        {fb.content}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Qualitative Reaction Selector Bar */}
              <div style={{ padding: "8px 12px", borderTop: "1px solid var(--border)", background: "var(--surface-hover)", display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--ink-soft)", textTransform: "uppercase", marginRight: "4px" }}>Reaction:</span>
                {REACTION_OPTIONS.map((opt) => {
                  const isSelected = selectedReaction === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={!canInteract}
                      onClick={() => {
                        if (!canInteract) return;
                        setSelectedReaction(isSelected ? null : opt.id);
                      }}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "3px 8px",
                        borderRadius: "14px",
                        fontSize: "12px",
                        fontWeight: isSelected ? 700 : 500,
                        border: isSelected ? "1px solid var(--castleton)" : "1px solid var(--border-color, rgba(255,255,255,0.1))",
                        backgroundColor: isSelected ? "rgba(16, 185, 129, 0.2)" : "rgba(255,255,255,0.04)",
                        color: isSelected ? "var(--castleton)" : "var(--ink-soft)",
                        cursor: canInteract ? "pointer" : "not-allowed",
                        opacity: canInteract ? 1 : 0.5,
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span>{opt.emoji}</span>
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Comment Input */}
              <div style={{ padding: "12px", borderTop: "1px solid var(--border)", background: "var(--bg)", display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  value={feedbackText}
                  disabled={!canInteract}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canInteract) handleSendFeedback();
                  }}
                  placeholder={
                    !canInteract
                      ? "Operators cannot leave feedback or comments"
                      : selectedReaction
                      ? `Add comments with ${REACTION_MAP[selectedReaction]?.label ?? "reaction"}...`
                      : "Add feedback..."
                  }
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    fontSize: "13px",
                    opacity: canInteract ? 1 : 0.6,
                    cursor: canInteract ? "text" : "not-allowed",
                  }}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!canInteract || (!feedbackText.trim() && !selectedReaction)}
                  onClick={handleSendFeedback}
                  style={{ padding: "8px 12px", cursor: canInteract ? "pointer" : "not-allowed", opacity: canInteract ? 1 : 0.5 }}
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
