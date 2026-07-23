"use client";

import { useMounted } from "@/lib/useMounted";
import type { Product, FeedbackReaction } from "@/lib/types";
import { CATEGORY_TREE } from "@/lib/data";
import { parseDriveFileId } from "@/lib/utils";
import { PlayCircleIcon } from "@/components/atoms/icons";
import { useFeedback } from "@/lib/useFeedback";
import { Send } from "lucide-react";
import { useState, useMemo, useEffect, useRef } from "react";

interface ClientVideoWatchViewProps {
  products: Product[];
  videoId: string;
  onBack: () => void;
  onNavigate: (newVideoId: string) => void;
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

const REACTION_OPTIONS: { id: FeedbackReaction; emoji: string; label: string }[] = [
  { id: "loved", emoji: "😍", label: "Loved it" },
  { id: "good", emoji: "👍", label: "Good" },
  { id: "neutral", emoji: "😐", label: "Neutral" },
  { id: "needs_work", emoji: "✍️", label: "Needs Revision" },
  { id: "unsatisfied", emoji: "😞", label: "Unsatisfied" },
];

const REACTION_MAP: Record<string, { emoji: string; label: string }> = Object.fromEntries(
  REACTION_OPTIONS.map((o) => [o.id, { emoji: o.emoji, label: o.label }])
);

export function ClientVideoWatchView({ products, videoId, onBack, onNavigate }: ClientVideoWatchViewProps) {
  const mounted = useMounted();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [isCommentFocused, setIsCommentFocused] = useState(false);
  const [selectedReaction, setSelectedReaction] = useState<FeedbackReaction | null>(null);
  const [currentCategory, setCurrentCategory] = useState("all");
  const [currentSubcategory, setCurrentSubcategory] = useState("all");

  const handleCategoryChange = (val: string) => {
    setCurrentCategory(val);
    setCurrentSubcategory("all");
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [videoId]);

  const product = products.find((p) => p.id === videoId);
  const item = product?.items[0];
  const { feedbackList, addFeedback } = useFeedback(product?.id);

  const publishedProducts = useMemo(() => {
    return products.filter((p) => p.items[0]?.status === "Published");
  }, [products]);

  const relatedProducts = useMemo(() => {
    if (!product) return [];
    let filtered = publishedProducts;
    if (currentCategory !== "all") {
      filtered = filtered.filter(p => p.category === currentCategory);
    }
    if (currentSubcategory !== "all") {
      filtered = filtered.filter(p => p.subcategory === currentSubcategory);
    }
    // Sort by age newest first
    return filtered.sort((a, b) => {
      const dateA = new Date(a.publishDate || a.createdAt).getTime();
      const dateB = new Date(b.publishDate || b.createdAt).getTime();
      return dateB - dateA;
    });
  }, [publishedProducts, product, currentCategory, currentSubcategory]);

  if (!mounted || !product || !item) return null;

  const videoUrl = item.videoUrl;
  const driveFileId = videoUrl ? parseDriveFileId(videoUrl) : null;
  const youtubeId = videoUrl ? getYoutubeId(videoUrl) : null;
  const isDirect = videoUrl ? isDirectVideoUrl(videoUrl) : false;

  const handleSendFeedback = () => {
    if (!feedbackText.trim() && !selectedReaction) return;
    const textToSend = feedbackText.trim() || (selectedReaction ? `[Reaction: ${REACTION_MAP[selectedReaction]?.label ?? selectedReaction}]` : "");
    addFeedback(product!.id, textToSend, selectedReaction);
    setFeedbackText("");
    setSelectedReaction(null);
  };

  const publishedText = product.publishDate
    ? new Date(`${product.publishDate}T00:00:00`).toLocaleDateString("en-US", { timeZone: "UTC" })
    : "—";

  return (
    <div className="client-video-watch-view">
      <div className="client-video-watch-split" style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
        {/* LEFT COLUMN: Player & Comments */}
        <div className="cvm-left" style={{ flex: '1', minWidth: 0, padding: 0, border: 'none' }}>
          
          <div className="cvm-player-wrapper" style={{ borderRadius: '16px', maxHeight: 'calc(100vh - 280px)', maxWidth: 'calc((100vh - 280px) * 16 / 9)', margin: '0 auto', display: 'flex', justifyContent: 'center', background: '#000' }}>
            {videoUrl ? (
              <>
                {driveFileId && (
                  <iframe
                    className="cvm-iframe"
                    src={`https://drive.google.com/file/d/${driveFileId}/preview`}
                    allow="autoplay"
                    allowFullScreen
                  />
                )}
                {youtubeId && !driveFileId && (
                  <iframe
                    className="cvm-iframe"
                    src={`https://www.youtube.com/embed/${youtubeId}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                )}
                {isDirect && !driveFileId && !youtubeId && (
                  <video
                    className="cvm-video"
                    src={videoUrl}
                    controls
                    autoPlay
                  />
                )}
                {!driveFileId && !youtubeId && !isDirect && (
                  <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="cvm-fallback">
                    <PlayCircleIcon />
                    <div>Open Video Link in New Tab</div>
                  </a>
                )}
              </>
            ) : (
              <div className="cvm-fallback">
                <div>Video file not available</div>
              </div>
            )}
          </div>

          <div className="cvm-meta-section" style={{ marginTop: '20px' }}>
            <h1 className="cvm-title" style={{ fontSize: '24px', marginBottom: '8px' }}>{product.name}</h1>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
              <div className="cvm-date" style={{ color: 'var(--ink-soft)', fontSize: '14px', fontWeight: 500 }}>Date Published: {publishedText}</div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>{product.category}</span>
                {product.subcategory && (
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>{product.subcategory}</span>
                )}
              </div>
            </div>
            {product.contentAngle ? (
              <p className="cvm-desc" style={{ background: 'transparent', padding: 0, border: 'none', lineHeight: '1.6', fontSize: '14px', color: 'var(--text-main)', margin: 0 }}>{product.contentAngle}</p>
            ) : (
              <p className="cvm-desc" style={{ color: 'var(--ink-soft)', fontStyle: 'italic', fontSize: '14px', margin: 0, padding: 0 }}>No description provided.</p>
            )}
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '24px 0' }} />

          {/* YouTube Style Comments */}
          <div className="cvm-comments-section" style={{ background: 'transparent', border: 'none', padding: 0 }}>
            <div className="cvm-comments-header" style={{ marginBottom: '16px', fontSize: '18px' }}>
              {feedbackList.length} Comment{feedbackList.length !== 1 ? "s" : ""}
            </div>

            <div 
              className="cvm-comment-input-row" 
              style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                marginBottom: '24px',
                background: 'transparent'
              }}
            >
              <div style={{ 
                position: 'relative', 
                marginBottom: (isCommentFocused || feedbackText.trim() || selectedReaction) ? '12px' : 0,
                background: (isCommentFocused || feedbackText.trim() || selectedReaction) ? 'var(--surface)' : 'transparent',
                borderTop: (isCommentFocused || feedbackText.trim() || selectedReaction) ? '1px solid var(--castleton)' : '1px solid transparent',
                borderLeft: (isCommentFocused || feedbackText.trim() || selectedReaction) ? '1px solid var(--castleton)' : '1px solid transparent',
                borderRight: (isCommentFocused || feedbackText.trim() || selectedReaction) ? '1px solid var(--castleton)' : '1px solid transparent',
                borderBottom: (isCommentFocused || feedbackText.trim() || selectedReaction) ? '1px solid var(--castleton)' : '1px solid var(--ink-soft)',
                borderRadius: (isCommentFocused || feedbackText.trim() || selectedReaction) ? '12px' : '0px',
                padding: (isCommentFocused || feedbackText.trim() || selectedReaction) ? '12px 16px' : '0 0 8px 0',
                boxShadow: isCommentFocused ? '0 0 8px var(--castleton-glow)' : 'none',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}>
                <textarea
                  ref={textareaRef}
                  className="cvm-comment-input"
                  placeholder={selectedReaction ? `Add comments with ${REACTION_MAP[selectedReaction]?.label ?? "reaction"}...` : "Add a comment..."}
                  value={feedbackText}
                  onFocus={() => setIsCommentFocused(true)}
                  onBlur={(e) => {
                    if (!e.currentTarget.value) {
                      setTimeout(() => setIsCommentFocused(false), 200);
                    }
                  }}
                  onChange={(e) => {
                    setFeedbackText(e.target.value);
                    e.target.style.height = '0px';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendFeedback();
                      setIsCommentFocused(false);
                      if (textareaRef.current) {
                        textareaRef.current.style.height = 'auto';
                      }
                    }
                  }}
                  rows={1}
                  style={{ 
                    background: 'transparent', 
                    width: '100%', 
                    padding: 0, 
                    border: 'none', 
                    outline: 'none',
                    resize: 'none',
                    fontSize: '14px',
                    lineHeight: '1.5',
                    overflow: 'hidden',
                    color: 'var(--text-main)'
                  }}
                />
              </div>
              
              {(isCommentFocused || feedbackText.trim() || selectedReaction) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                    {REACTION_OPTIONS.map((opt) => {
                      const isSelected = selectedReaction === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setSelectedReaction(isSelected ? null : opt.id)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "4px 10px",
                            borderRadius: "16px",
                            border: `1px solid ${isSelected ? "rgba(16, 185, 129, 0.4)" : "var(--border)"}`,
                            background: isSelected ? "rgba(16, 185, 129, 0.12)" : "transparent",
                            cursor: "pointer",
                            transition: "all 0.2s ease"
                          }}
                        >
                          <span style={{ fontSize: "14px" }}>{opt.emoji}</span>
                          <span style={{ fontSize: "12px", fontWeight: isSelected ? 700 : 500, color: isSelected ? "var(--castleton)" : "var(--ink-soft)" }}>
                            {opt.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      type="button"
                      onClick={() => {
                        setFeedbackText("");
                        setSelectedReaction(null);
                        setIsCommentFocused(false);
                        if (textareaRef.current) {
                          textareaRef.current.style.height = 'auto';
                        }
                      }}
                      style={{ padding: '8px 16px', borderRadius: '20px', background: 'transparent', color: 'var(--text-main)', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
                    >
                      Cancel
                    </button>
                    <button 
                      type="button" 
                      disabled={!feedbackText.trim() && !selectedReaction}
                      onClick={() => {
                        handleSendFeedback();
                        setIsCommentFocused(false);
                        if (textareaRef.current) {
                          textareaRef.current.style.height = 'auto';
                        }
                      }}
                      style={{ padding: '8px 16px', borderRadius: '20px', background: (!feedbackText.trim() && !selectedReaction) ? 'transparent' : 'var(--castleton)', color: (!feedbackText.trim() && !selectedReaction) ? 'var(--ink-soft)' : '#fff', border: (!feedbackText.trim() && !selectedReaction) ? '1px solid var(--border)' : 'none', cursor: (!feedbackText.trim() && !selectedReaction) ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '13px' }}
                    >
                      Comment
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="cvm-comments-list">
              {[...feedbackList].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((fb, index) => (
                <div 
                  key={fb.id} 
                  className="cvm-comment-item cvm-comment-animated" 
                  style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '6px', animationDelay: `${index * 0.1}s` }}
                >
                  <div className="cvm-comment-author" style={{ marginBottom: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="cvm-comment-author-name">{fb.userEmail}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {fb.reaction && REACTION_MAP[fb.reaction] && (
                        <span style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "12px", background: "rgba(16, 185, 129, 0.12)", color: "var(--castleton)", border: "1px solid rgba(16, 185, 129, 0.25)", fontWeight: 700 }}>
                          {REACTION_MAP[fb.reaction].emoji} {REACTION_MAP[fb.reaction].label}
                        </span>
                      )}
                      <span className="cvm-comment-time" style={{ fontWeight: 500, color: 'var(--ink-soft)', fontSize: '11px' }}>{new Date(fb.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="cvm-comment-text" style={{ fontSize: '14px', lineHeight: '1.6', color: 'var(--text-main)' }}>{fb.content}</div>
                </div>
              ))}
              {feedbackList.length === 0 && (
                <div className="cvm-no-comments" style={{ textAlign: 'left', padding: '24px 0', color: 'var(--ink-soft)' }}>No comments yet. Be the first to share your thoughts!</div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Sidebar List */}
        <div className="cvm-right" style={{ width: '400px', flexShrink: 0, padding: 0, background: 'transparent' }}>
          <div className="filter-row-left" style={{ marginBottom: '20px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => handleCategoryChange("all")}
              className={`cvm-filter-pill${currentCategory === "all" ? " active" : ""}`}
            >
              All
            </button>
            <select
              className="filter-select"
              value={currentCategory}
              onChange={(event) => handleCategoryChange(event.target.value)}
              style={{ flex: 1, minWidth: 0, padding: '8px 12px', border: 'none', background: 'transparent', fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer', appearance: 'none' }}
            >
              <option value="all">Category</option>
              {Object.keys(CATEGORY_TREE).map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <select
              className="filter-select"
              value={currentSubcategory}
              disabled={currentCategory === "all"}
              onChange={(event) => setCurrentSubcategory(event.target.value)}
              style={{ 
                flex: 1, minWidth: 0, padding: '8px 12px', borderRadius: '8px', 
                border: currentCategory === 'all' ? '1px dashed var(--border)' : '1px solid var(--border)', 
                background: currentCategory === 'all' ? 'transparent' : 'var(--surface)', 
                fontSize: '13px', color: currentCategory === 'all' ? 'var(--ink-soft)' : 'var(--text-main)', 
                cursor: currentCategory === 'all' ? 'not-allowed' : 'pointer' 
              }}
            >
              {currentCategory === "all" ? (
                <option value="all">Sub-category</option>
              ) : (
                <>
                  <option value="all">All Sub-categories</option>
                  {CATEGORY_TREE[currentCategory as keyof typeof CATEGORY_TREE]?.map((subcategory) => (
                    <option key={subcategory} value={subcategory}>{subcategory}</option>
                  ))}
                </>
              )}
            </select>
          </div>

          <div className="cvm-sidebar-list">
            {relatedProducts.map((relProduct) => {
              const relPublishedText = relProduct.publishDate
                ? new Date(`${relProduct.publishDate}T00:00:00`).toLocaleDateString("en-US", { timeZone: "UTC" })
                : "—";
              return (
                <div 
                  key={relProduct.rank} 
                  className={`cvm-sidebar-card ${relProduct.id === product.id ? 'playing' : ''}`}
                  onClick={() => onNavigate(relProduct.id)}
                  style={{ 
                    padding: '8px', borderRadius: '12px', gap: '12px',
                    background: relProduct.id === product.id ? 'var(--surface-hover)' : 'transparent',
                    border: 'none'
                  }}
                >
                  <div className="cvm-sc-thumb" style={{ width: '160px', height: '90px', borderRadius: '8px', background: 'var(--surface)' }}>
                    {relProduct.thumbnailUrl ? (
                      <img src={relProduct.thumbnailUrl} alt={relProduct.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div className="cvm-sc-placeholder" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: "var(--ink-soft)", background: "var(--glass-bg)", border: "1px dashed var(--glass-border)", borderRadius: "8px" }}><PlayCircleIcon /></div>
                    )}
                  </div>
                  <div className="cvm-sc-info" style={{ flex: 1, minWidth: 0, justifyContent: 'flex-start', paddingTop: '4px' }}>
                    <div className="cvm-sc-title" title={relProduct.name} style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>{relProduct.name}</div>
                    <div className="cvm-sc-tags" style={{ display: 'flex', gap: '4px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-main)' }}>{relProduct.category}</span>
                      {relProduct.subcategory && <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-main)' }}>{relProduct.subcategory}</span>}
                    </div>
                    <div className="cvm-sc-date" style={{ fontSize: '12px', color: 'var(--ink-soft)' }}>{relPublishedText}</div>
                  </div>
                </div>
              );
            })}
            {relatedProducts.length === 0 && (
              <div style={{ color: "var(--ink-soft)", fontSize: "13px", textAlign: "left", marginTop: "20px" }}>
                No related videos found.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
