"use client";

import { useState } from "react";
import { STATUS_ORDER } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import type { Issue, Product } from "@/lib/types";
import type { StageAge } from "@/lib/useStageAge";
import { getModalKey } from "@/lib/utils";
import { StageAgeBadge } from "./StageAgeBadge";

interface KanbanBoardProps {
  products: Product[];
  issues: Issue[];
  canEditProduction: boolean;
  stageAgeByProductId: Map<string, StageAge>;
  profileEmailById: Map<string, string>;
  onOpenModal: (key: string) => void;
}

export function KanbanBoard({
  products,
  issues,
  canEditProduction,
  stageAgeByProductId,
  profileEmailById,
  onOpenModal,
}: KanbanBoardProps) {
  const [movingId, setMovingId] = useState<string | null>(null);

  const moveStage = async (product: Product, direction: -1 | 1) => {
    const currentIndex = STATUS_ORDER.indexOf(product.items[0].status);
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= STATUS_ORDER.length) return;

    setMovingId(product.id);
    const supabase = createClient();
    await supabase
      .from("products")
      .update({ status: STATUS_ORDER[nextIndex] })
      .eq("id", product.id);
    setMovingId(null);
  };

  return (
    <div className="kanban-board">
      {STATUS_ORDER.map((status) => {
        const columnProducts = products.filter(
          (product) => product.items[0].status === status,
        );

        return (
          <div key={status} className="kanban-column">
            <div className="kanban-column-header">
              {status}
              <span className="kanban-column-count">{columnProducts.length}</span>
            </div>
            <div className="kanban-column-body">
              {columnProducts.map((product) => {
                const openCount = issues.filter(
                  (issue) => issue.rank === product.rank && issue.status === "open",
                ).length;
                const ownerLabel = product.ownerId
                  ? profileEmailById.get(product.ownerId)
                  : product.owner;
                const currentIndex = STATUS_ORDER.indexOf(status);

                return (
                  <div
                    key={product.id}
                    className="kanban-card"
                    onClick={() => onOpenModal(getModalKey(product.rank, 0))}
                  >
                    <div className="kanban-card-title">
                      <span className="video-table-id">{product.rank}</span>{" "}
                      {product.name}
                    </div>
                    <div className="kanban-card-meta">
                      {ownerLabel ? <span>{ownerLabel}</span> : null}
                      <StageAgeBadge
                        days={stageAgeByProductId.get(product.id)?.days}
                      />
                      {openCount > 0 ? (
                        <span className="issue-btn has-issues">
                          🚩 {openCount}
                        </span>
                      ) : null}
                    </div>
                    {canEditProduction ? (
                      <div className="kanban-card-actions">
                        <button
                          type="button"
                          disabled={currentIndex === 0 || movingId === product.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            moveStage(product, -1);
                          }}
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          disabled={
                            currentIndex === STATUS_ORDER.length - 1 ||
                            movingId === product.id
                          }
                          onClick={(event) => {
                            event.stopPropagation();
                            moveStage(product, 1);
                          }}
                        >
                          →
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
