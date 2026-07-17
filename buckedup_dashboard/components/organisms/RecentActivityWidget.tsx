import type { Product } from "@/lib/types";
import { CheckCircle2, Video, Clock, CircleDashed, Eye, Pencil, BookOpen, FileText, Wand2 } from "lucide-react";
import { Tilt } from "@/components/atoms/Tilt";

interface RecentActivityWidgetProps {
  products: Product[];
  isOperatorView?: boolean;
}

/** Colour + icon for each pipeline stage in the operator's status view. */
const STAGE_STYLE: Record<string, { bg: string; text: string; border: string; icon: React.ReactNode }> = {
  "Not Started":   { bg: "rgba(150,150,150,0.10)", text: "var(--ink-soft)",    border: "rgba(150,150,150,0.25)", icon: <CircleDashed size={13} /> },
  "Storyboarding": { bg: "rgba(129,140,248,0.10)", text: "#818cf8",           border: "rgba(129,140,248,0.25)", icon: <BookOpen size={13} /> },
  "Scripting":     { bg: "rgba(96,165,250,0.10)",  text: "#60a5fa",           border: "rgba(96,165,250,0.25)",  icon: <FileText size={13} /> },
  "Prompting":     { bg: "rgba(251,191,36,0.10)",  text: "#fbbf24",           border: "rgba(251,191,36,0.25)",  icon: <Wand2 size={13} /> },
  "Editing":       { bg: "rgba(56,189,248,0.10)",  text: "#38bdf8",           border: "rgba(56,189,248,0.25)",  icon: <Pencil size={13} /> },
  "In Review":     { bg: "rgba(253,224,71,0.10)",  text: "#fde047",           border: "rgba(253,224,71,0.25)",  icon: <Eye size={13} /> },
  "Published":     { bg: "var(--castleton-glow)",   text: "var(--castleton)",  border: "var(--glass-border)",    icon: <CheckCircle2 size={13} /> },
};

function stagePill(stage: string) {
  const s = STAGE_STYLE[stage] ?? STAGE_STYLE["Not Started"];
  return (
    <div
      className="flex items-center gap-1.5"
      style={{
        fontSize: "10px",
        fontWeight: 600,
        color: s.text,
        background: s.bg,
        border: `1px solid ${s.border}`,
        padding: "3px 10px",
        borderRadius: "9999px",
        whiteSpace: "nowrap",
      }}
    >
      {s.icon}
      {stage}
    </div>
  );
}

export function RecentActivityWidget({ products, isOperatorView }: RecentActivityWidgetProps) {
  if (isOperatorView) {
    // Operator view: show all assigned products sorted by stage progress (most advanced first)
    const STAGE_ORDER = ["Published", "In Review", "Editing", "Prompting", "Scripting", "Storyboarding", "Not Started"];
    const sorted = [...products]
      .sort((a, b) => {
        const ai = STAGE_ORDER.indexOf(a.items[0]?.status ?? "Not Started");
        const bi = STAGE_ORDER.indexOf(b.items[0]?.status ?? "Not Started");
        return ai - bi;
      })
      .slice(0, 6);

    return (
      <Tilt maxTilt={4} className="w-full h-full flex">
        <div className="panel panel-glass flex flex-col p-6 gap-4" style={{ flex: 1 }}>
          <div>
            <div className="section-heading flex items-center gap-2 font-bold mb-1">
              <Clock size={20} className="text-[var(--saffron)]" />
              My Deliverable Status
            </div>
            <div className="section-sub text-xs mb-4">
              Current pipeline status of your assigned video tasks.
            </div>
          </div>

          <div className="activity-list flex flex-col gap-3 mt-auto">
            {sorted.length === 0 ? (
              <div className="text-xs py-4" style={{ color: 'var(--ink-soft)' }}>No tasks assigned to you yet.</div>
            ) : (
              sorted.map((product) => {
                const stage = product.items[0]?.status ?? "Not Started";
                return (
                  <div
                    key={product.rank}
                    className="flex items-center gap-3 p-3 bg-[var(--glass-bg)] rounded-xl border border-[var(--glass-border)] hover:border-[var(--saffron)] transition-all duration-300"
                  >
                    <div className="w-8 h-8 rounded-full bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--ink-soft)] flex items-center justify-center flex-shrink-0" style={{ fontSize: '11px', fontWeight: 700 }}>
                      {product.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold truncate">
                        {product.name}
                      </div>
                      <div className="text-[10px] font-medium truncate" style={{ color: 'var(--ink-soft)' }}>
                        {product.category}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {stagePill(stage)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Tilt>
    );
  }

  // Default view: Recent Deliveries (admin / lead)
  const recent = [...products]
    .filter((p) => p.reviewStatus === "Accepted" || p.items.some(i => i.status === "Published"))
    .sort((a, b) => {
      if (a.publishDate && b.publishDate) {
        return new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime();
      }
      if (a.publishDate) return -1;
      if (b.publishDate) return 1;
      return b.rank - a.rank;
    })
    .slice(0, 4);

  return (
    <Tilt maxTilt={4} className="w-full h-full flex">
      <div className="panel panel-glass flex flex-col p-6 gap-4" style={{ flex: 1 }}>
        <div>
          <div className="section-heading flex items-center gap-2 font-bold mb-1">
            <CheckCircle2 size={20} className="text-[var(--castleton)]" />
            Recent Deliveries
          </div>
          <div className="section-sub text-xs mb-4">
            Latest videos published and approved in the queue.
          </div>
        </div>
        
        <div className="activity-list grid grid-cols-1 md:grid-cols-2 gap-4 mt-auto">
          {recent.length === 0 ? (
            <div className="text-xs py-4 col-span-2" style={{ color: 'var(--ink-soft)' }}>No recent deliveries found.</div>
          ) : (
            recent.map((product) => (
              <div 
                key={product.rank} 
                className="flex items-center gap-3 p-3 bg-[var(--glass-bg)] rounded-xl border border-[var(--glass-border)] hover:border-[var(--castleton)] transition-all duration-300 cursor-pointer hover:shadow-sm"
                onClick={() => {
                  // MODIFIED: Made the delivery item interactive
                  window.location.href = `/library?product=${product.id || product.catalogProductId}`;
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    window.location.href = `/library?product=${product.id || product.catalogProductId}`;
                  }
                }}
              >
                <div className="w-9 h-9 rounded-full bg-[var(--castleton-glow)] text-[var(--castleton)] flex items-center justify-center flex-shrink-0">
                  <Video size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate group-hover:text-[var(--castleton)] transition-colors">
                    {product.name}
                  </div>
                  <div className="text-[10px] font-medium truncate" style={{ color: 'var(--ink-soft)' }}>
                    {product.category}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <div className="text-[10px] font-semibold text-[var(--castleton)] bg-[var(--castleton-glow)] px-2.5 py-1 rounded-full border border-[var(--glass-border)]">
                    Approved
                  </div>
                  <span className="text-[9px]" style={{ color: 'var(--ink-soft)', fontWeight: 600 }}>
                    {product.publishDate ? new Date(product.publishDate).toLocaleDateString(undefined, {month: 'short', day: 'numeric'}) : 'No date'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Tilt>
  );
}
