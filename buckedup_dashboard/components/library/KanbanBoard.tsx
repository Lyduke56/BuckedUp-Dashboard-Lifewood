"use client";

import { useState, type DragEvent } from "react";
import { STATUS_ORDER } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import type { Issue, PipelineStatus, Product } from "@/lib/types";
import { getModalKey } from "@/lib/utils";

interface KanbanBoardProps {
  products: Product[];
  issues: Issue[];
  canMoveStage: boolean;
  profileEmailById: Map<string, string>;
  onOpenModal: (key: string) => void;
}

export function KanbanBoard({
  products,
  issues,
  canMoveStage,
  profileEmailById,
  onOpenModal,
}: KanbanBoardProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<PipelineStatus | null>(null);

  const moveToStage = async (productId: string, status: PipelineStatus) => {
    const supabase = createClient();
    await supabase.from("products").update({ status }).eq("id", productId);
  };

  return (
    <div className="kanban-board">
      {STATUS_ORDER.map((status) => {
        const columnProducts = products.filter(
          (product) => product.items[0].status === status,
        );

        return (
          <div
            key={status}
            className={`kanban-column${dragOverStatus === status ? " drag-over" : ""}`}
            onDragOver={(event) => {
              if (!canMoveStage || !draggingId) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setDragOverStatus(status);
            }}
            onDragLeave={() =>
              setDragOverStatus((prev) => (prev === status ? null : prev))
            }
            onDrop={(event) => {
              event.preventDefault();
              setDragOverStatus(null);
              const productId = event.dataTransfer.getData("text/plain");
              if (productId) moveToStage(productId, status);
            }}
          >
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

                return (
                  <div
                    key={product.id}
                    className={`kanban-card${draggingId === product.id ? " dragging" : ""}${canMoveStage ? " draggable" : ""}`}
                    draggable={canMoveStage}
                    onDragStart={(event: DragEvent<HTMLDivElement>) => {
                      event.dataTransfer.setData("text/plain", product.id);
                      event.dataTransfer.effectAllowed = "move";
                      setDraggingId(product.id);
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setDragOverStatus(null);
                    }}
                    onClick={() => onOpenModal(getModalKey(product.rank, 0))}
                  >
                    <div className="kanban-card-title">
                      <span className="video-table-id">{product.rank}</span>{" "}
                      {product.name}
                    </div>
                    <div className="kanban-card-meta">
                      {ownerLabel ? <span>{ownerLabel}</span> : null}
                      {openCount > 0 ? (
                        <span className="issue-btn has-issues">
                          🚩 {openCount}
                        </span>
                      ) : null}
                    </div>
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
