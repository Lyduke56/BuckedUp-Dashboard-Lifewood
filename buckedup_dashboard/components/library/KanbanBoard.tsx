import { useState, type DragEvent } from "react";
import { STATUS_HEX, STATUS_ORDER } from "@/lib/data";
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

interface KanbanTooltipState {
  x: number;
  y: number;
  product: Product | null;
  ownerLabel: string;
  openCount: number;
  visible: boolean;
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
  const [tooltip, setTooltip] = useState<KanbanTooltipState>({
    x: 0,
    y: 0,
    product: null,
    ownerLabel: "",
    openCount: 0,
    visible: false,
  });

  const moveToStage = async (productId: string, status: PipelineStatus) => {
    const supabase = createClient();
    await supabase.from("products").update({ status }).eq("id", productId);
  };

  const showTooltip = (e: React.MouseEvent, product: Product, ownerLabel: string, openCount: number) => {
    setTooltip({
      x: e.clientX,
      y: e.clientY,
      product,
      ownerLabel,
      openCount,
      visible: true,
    });
  };

  const moveTooltip = (e: React.MouseEvent) => {
    setTooltip((t) => ({ ...t, x: e.clientX, y: e.clientY }));
  };

  const hideTooltip = () => {
    setTooltip((t) => ({ ...t, visible: false }));
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
                const displayOwner = ownerLabel ?? "Unassigned";

                return (
                  <div
                    key={product.id}
                    className={`kanban-card${draggingId === product.id ? " dragging" : ""}${canMoveStage ? " draggable" : ""}`}
                    data-status={status}
                    draggable={canMoveStage}
                    onDragStart={(event: DragEvent<HTMLDivElement>) => {
                      event.dataTransfer.setData("text/plain", product.id);
                      event.dataTransfer.effectAllowed = "move";
                      setDraggingId(product.id);
                      hideTooltip();
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setDragOverStatus(null);
                    }}
                    onClick={() => {
                      hideTooltip();
                      onOpenModal(getModalKey(product.rank, 0));
                    }}
                    onMouseMove={(e) => {
                      showTooltip(e, product, displayOwner, openCount);
                      moveTooltip(e);
                    }}
                    onMouseLeave={hideTooltip}
                  >
                    <div className="kanban-card-title">
                      <span className="video-table-id">{product.rank}</span>{" "}
                      {product.name}
                    </div>
                    <div className="kanban-card-meta">
                      {ownerLabel ? <span className="kanban-card-owner-text">{ownerLabel}</span> : null}
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

      {/* Kanban Board Floating Tooltip */}
      {tooltip.visible && tooltip.product && (
        <div
          className="chart-tooltip kanban-tooltip"
          style={{
            position: "fixed",
            left: tooltip.x + 14,
            top: tooltip.y - 8,
            zIndex: 10000,
            pointerEvents: "none",
            borderColor: STATUS_HEX[tooltip.product.items[0].status as PipelineStatus],
          }}
        >
          <div style={{ fontWeight: 800, fontSize: "12px", borderBottom: "1px solid var(--line)", paddingBottom: "4px", marginBottom: "4px" }}>
            {tooltip.product.name}
          </div>
          <div><strong>Category:</strong> {tooltip.product.category}</div>
          <div><strong>Subcategory:</strong> {tooltip.product.subcategory}</div>
          <div><strong>Language:</strong> {tooltip.product.language}</div>
          <div><strong>Owner:</strong> {tooltip.ownerLabel}</div>
          <div><strong>Stage:</strong> <span style={{ color: STATUS_HEX[tooltip.product.items[0].status as PipelineStatus], fontWeight: 700 }}>{tooltip.product.items[0].status}</span></div>
          {tooltip.openCount > 0 && (
            <div style={{ color: "#ef4444", fontWeight: 700 }}>
              ⚠️ {tooltip.openCount} open issue{tooltip.openCount === 1 ? "" : "s"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
