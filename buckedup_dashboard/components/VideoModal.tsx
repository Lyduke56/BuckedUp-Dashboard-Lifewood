"use client";

import { products } from "@/lib/data";
import { parseModalKey } from "@/lib/utils";
import { PlayCircleIcon, VideoCameraIcon } from "./icons";

interface VideoModalProps {
  modalKey: string | null;
  onClose: () => void;
}

export function VideoModal({ modalKey, onClose }: VideoModalProps) {
  if (!modalKey) return null;

  const { rank, index } = parseModalKey(modalKey);
  const product = products.find((p) => p.rank === rank);
  const item = product?.items[index];

  if (!product || !item) return null;

  const isReady = Boolean(item.videoUrl);

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
        <div className={`video-placeholder${isReady ? " ready" : ""}`}>
          {isReady ? <PlayCircleIcon /> : <VideoCameraIcon />}
          <div className="vp-title">
            {isReady ? "Video ready to watch" : "No video uploaded yet"}
          </div>
          <div className="vp-sub">
            {isReady
              ? "Published — available in the source Google Sheet"
              : `Currently in ${item.status.toLowerCase()} — this slot will hold the AIGC video once produced`}
          </div>
        </div>
      </div>
    </div>
  );
}
