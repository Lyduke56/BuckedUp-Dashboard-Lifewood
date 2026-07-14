import type { Product } from "@/lib/types";
import { CheckCircle2, Video } from "lucide-react";
import { Tilt } from "@/components/atoms/Tilt";

interface RecentActivityWidgetProps {
  products: Product[];
}

export function RecentActivityWidget({ products }: RecentActivityWidgetProps) {
  // Sort the "Accepted" or "Published" products by publishDate descending
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
                className="flex items-center gap-3 p-3 bg-[var(--glass-bg)] rounded-xl border border-[var(--glass-border)] hover:border-[var(--castleton)] transition-all duration-300"
              >
                <div className="w-9 h-9 rounded-full bg-[var(--castleton-glow)] text-[var(--castleton)] flex items-center justify-center flex-shrink-0">
                  <Video size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate">
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

