"use client";

import type { Product } from "@/lib/types";
import { parseDriveFileId, parseModalKey } from "@/lib/utils";
import { PlayCircleIcon, VideoCameraIcon } from "./icons";

interface VideoModalProps {
  products: Product[];
  modalKey: string | null;
  onClose: () => void;
}

export function VideoModal({ products, modalKey, onClose }: VideoModalProps) {
  if (!modalKey) return null;

  const { rank, index } = parseModalKey(modalKey);
  const product = products.find((p) => p.rank === rank);
  const item = product?.items[index];

  if (!product || !item) return null;

  const videoUrl = item.videoUrl;
  const driveFileId = videoUrl ? parseDriveFileId(videoUrl) : null;

  return (
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
          driveFileId ? (
            <>
              <iframe
                className="video-embed"
                src={`https://drive.google.com/file/d/${driveFileId}/preview`}
                allow="autoplay"
                allowFullScreen
              />
              <div className="video-embed-actions">
                <a
                  href={videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="video-link"
                >
                  ↗ Open in new tab
                </a>
              </div>
            </>
          ) : (
            <div className="video-placeholder ready">
              <PlayCircleIcon />
              <div className="vp-title">Video ready to watch</div>
              <div className="vp-sub">
                Published — available in the source Google Sheet
              </div>
              <a
                href={videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="video-link"
              >
                ↗ Open in new tab
              </a>
            </div>
          )
        ) : (
          <div className="video-placeholder">
            <VideoCameraIcon />
            <div className="vp-title">No video uploaded yet</div>
            <div className="vp-sub">
              {`Currently in ${item.status.toLowerCase()} — this slot will hold the AIGC video once produced`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
