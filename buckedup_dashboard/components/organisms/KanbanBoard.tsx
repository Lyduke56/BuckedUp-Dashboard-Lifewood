import { useState, type DragEvent } from "react";
import { STATUS_HEX, STATUS_HEX_LIGHT, STATUS_ORDER } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import type { Issue, PipelineStatus, Product } from "@/lib/types";
import { getModalKey } from "@/lib/utils";
import { ChartTooltip } from "@/components/atoms/ChartTooltip";

interface KanbanBoardProps {
  products: Product[];
  issues: Issue[];
  canMoveStage: boolean;
  profileEmailById: Map<string, string>;
  onOpenModal: (key: string) => void;
  theme: "dark" | "light";
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
  theme,
}: KanbanBoardProps) {
  // The board's structural chrome (backgrounds/borders/text) already
  // re-themes via CSS custom properties, but these inline per-status
  // accent colors can't be — pick the light-safe map in light mode so the
  // column dot/border and tooltip stay readable against a white card.
  const statusHex = theme === "light" ? STATUS_HEX_LIGHT : STATUS_HEX;
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
            style={{
              "--stage-color": statusHex[status],
            } as React.CSSProperties}
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
            <div
              className="kanban-column-header"
              style={{ borderLeft: `3px solid ${statusHex[status]}` }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                <span
                  style={{
                    display: "inline-block",
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: statusHex[status],
                    flexShrink: 0,
                  }}
                />
                {status}
              </div>
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
        <ChartTooltip
          isVisible={tooltip.visible}
          x={tooltip.x + 14}
          y={tooltip.y - 8}
          borderColor={statusHex[tooltip.product.items[0].status as PipelineStatus]}
          content={
            <>
              <div style={{ fontWeight: 800, fontSize: "12px", borderBottom: "1px solid var(--line)", paddingBottom: "4px", marginBottom: "4px" }}>
                {tooltip.product.name}
              </div>
              <div><strong>Category:</strong> {tooltip.product.category}</div>
              <div><strong>Subcategory:</strong> {tooltip.product.subcategory}</div>
              <div><strong>Language:</strong> {tooltip.product.language}</div>
              <div><strong>Owner:</strong> {tooltip.ownerLabel}</div>
              <div><strong>Stage:</strong> <span style={{ color: statusHex[tooltip.product.items[0].status as PipelineStatus], fontWeight: 700 }}>{tooltip.product.items[0].status}</span></div>
              {tooltip.openCount > 0 && (
                <div style={{ color: "#ef4444", fontWeight: 700 }}>
                  ⚠️ {tooltip.openCount} open issue{tooltip.openCount === 1 ? "" : "s"}
                </div>
              )}
            </>
          }
        />
      )}
    </div>
  );
}
