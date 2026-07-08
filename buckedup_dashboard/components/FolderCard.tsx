"use client";

import { STATUS_CLASS } from "@/lib/data";
import type { Product } from "@/lib/types";
import { FolderIconFilled } from "./icons";
import { Card } from "./Card";

interface FolderCardProps {
  product: Product;
  rank: number;
  total: number;
  done: number;
  progressPct: number;
  accentColor: string;
  onClick: () => void;
}

export function FolderCard({
  product,
  rank,
  total,
  done,
  progressPct,
  accentColor,
  onClick,
}: FolderCardProps) {
  const firstStatus = product.items[0]?.status;

  return (
    <Card variant="folder" height={210} onClick={onClick}>
      <div className="folder-top">
        <FolderIconFilled />
        <div className="rank-chip" style={{ background: accentColor }}>
          <span>{rank}</span>
        </div>
      </div>

      <div className="folder-name">{product.name}</div>
      <div className="folder-meta">
        {product.category} · {total} video{total > 1 ? "s" : ""}
      </div>

      {/* pinned to the bottom via margin-top: auto, regardless of title length */}
      <div className="folder-card-footer">
        {firstStatus ? (
          <span className={`status-pill ${STATUS_CLASS[firstStatus]}`}>
            {firstStatus}
          </span>
        ) : null}
        <div className="folder-progress-track">
          <div
            className="folder-progress-fill"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="folder-bottom">
          <span className="folder-count">
            {done}/{total} recorded
          </span>
        </div>
      </div>
    </Card>
  );
}