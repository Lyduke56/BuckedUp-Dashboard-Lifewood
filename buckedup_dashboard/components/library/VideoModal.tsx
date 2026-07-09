"use client";

import { createPortal } from "react-dom";
import { useMounted } from "@/lib/useMounted";
import type { Product } from "@/lib/types";
import { parseModalKey } from "@/lib/utils";
import { VideoCameraIcon } from "@/components/shared/icons";

interface VideoModalProps {
  products: Product[];
  modalKey: string | null;
  onClose: () => void;
}

export function VideoModal({ products, modalKey, onClose }: VideoModalProps) {
  const mounted = useMounted();

  if (!modalKey) return null;
  if (!mounted) return null;

  const { rank, index } = parseModalKey(modalKey);
  const product = products.find((p) => p.rank === rank);
  const item = product?.items[index];

  if (!product || !item) return null;

  const videoUrl = item.videoUrl;
  const isPublished = item.status === "Published";

  const metaParts = [
    product.type,
    product.owner,
    product.publishDate ? `Published ${product.publishDate}` : null,
  ].filter((part): part is string => Boolean(part));

  return createPortal(
    <div
      className={`overlay show`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
      role="presentation"
    >
      <div className="modal">
        <button type="button" className="modal-close" onClick={onClose}>
          ✕
        </button>
        {videoUrl ? (
          <>
            {!isPublished && (
              <div className="video-early-badge">
                ⏳ Early cut — currently {item.status}, not yet Published
              </div>
            )}
            <video className="video-embed" src={videoUrl} controls playsInline />
          </>
        ) : (
          <div className="video-placeholder">
            <VideoCameraIcon />
            <div className="vp-title">No video uploaded yet</div>
            <div className="vp-sub">
              {`Currently in ${item.status.toLowerCase()} — this slot will hold the AIGC video once produced`}
            </div>
          </div>
        )}
        <div className="video-modal-info">
          <div className="video-modal-title">{product.name}</div>
          {metaParts.length > 0 ? (
            <div className="video-modal-meta">
              {metaParts.map((part, index) => (
                <span key={part}>
                  {index > 0 ? (
                    <span className="video-modal-meta-sep"> • </span>
                  ) : null}
                  {part}
                </span>
              ))}
            </div>
          ) : null}
          {product.contentAngle ? (
            <div className="video-modal-description">
              <div className="video-modal-description-label">
                Description
              </div>
              {product.contentAngle}
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
