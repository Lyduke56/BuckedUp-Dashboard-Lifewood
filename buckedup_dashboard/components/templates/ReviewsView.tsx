import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronLeft, ChevronRight, Trash2, CheckSquare, Square } from "lucide-react";
import type { Product, StageDeliverable } from "@/lib/types";
import { useProfiles } from "@/lib/useProfiles";
import { PageHeader } from "@/components/molecules/PageHeader";

interface ReviewsViewProps {
  products: Product[];
  currentByKey: Map<string, StageDeliverable>;
  onReviewProduct: (rank: number) => void;
}

// Helper to safely format relative time natively
function timeAgo(dateStr?: string | null) {
  if (!dateStr) return "";
  try {
    const time = new Date(dateStr).getTime();
    const now = Date.now();
    const diff = now - time;
    
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    
    return `${Math.floor(months / 12)}y ago`;
  } catch (e) {
    return "";
  }
}

export function ReviewsView({ products, currentByKey, onReviewProduct }: ReviewsViewProps) {
  const { profiles } = useProfiles();
  const [clickedItemKeys, setClickedItemKeys] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"pending" | "reviewed">("pending");
  const [expandedReviewedId, setExpandedReviewedId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterOperator, setFilterOperator] = useState("all");
  const [filterStage, setFilterStage] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [clearedReviewedIds, setClearedReviewedIds] = useState<Set<string>>(new Set());
  const [selectedReviewedIds, setSelectedReviewedIds] = useState<Set<string>>(new Set());

  // Load "read" and "cleared" state from localStorage on mount
  useEffect(() => {
    try {
      const storedRead = localStorage.getItem("buckedup_read_reviews");
      if (storedRead) {
        setClickedItemKeys(new Set(JSON.parse(storedRead)));
      }
      const storedCleared = localStorage.getItem("buckedup_cleared_reviews");
      if (storedCleared) {
        setClearedReviewedIds(new Set(JSON.parse(storedCleared)));
      }
    } catch (e) {
      console.warn("Failed to read local storage", e);
    }
  }, []);

  // Save "read" state whenever it changes
  useEffect(() => {
    if (clickedItemKeys.size > 0) {
      localStorage.setItem("buckedup_read_reviews", JSON.stringify(Array.from(clickedItemKeys)));
    }
  }, [clickedItemKeys]);

  // Save "cleared" state whenever it changes
  useEffect(() => {
    if (clearedReviewedIds.size > 0) {
      localStorage.setItem("buckedup_cleared_reviews", JSON.stringify(Array.from(clearedReviewedIds)));
    } else {
      localStorage.removeItem("buckedup_cleared_reviews");
    }
  }, [clearedReviewedIds]);

  // Reset page to 1 when filters or tabs change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedReviewedIds(new Set());
  }, [searchQuery, filterOperator, filterStage, activeTab]);

  const handleClearSelected = () => {
    setClearedReviewedIds(prev => {
      const next = new Set(prev);
      selectedReviewedIds.forEach(id => next.add(id));
      return next;
    });
    setSelectedReviewedIds(new Set());
  };

  const handleClearAll = () => {
    setClearedReviewedIds(prev => {
      const next = new Set(prev);
      filteredReviewedItems.forEach(item => next.add(item.itemKey));
      return next;
    });
    setSelectedReviewedIds(new Set());
  };

  const handleItemClick = (rank: number, itemKey: string) => {
    setClickedItemKeys(prev => {
      const next = new Set(prev);
      next.add(itemKey);
      return next;
    });
    onReviewProduct(rank);
  };

  // Compute the list of pending items
  const pendingItems = useMemo(() => {
    const items: Array<{
      product: Product;
      deliverable: StageDeliverable | null;
      stage: string;
      itemKey: string;
    }> = [];

    for (const p of products) {
      if (p.deliveryType !== "pipeline") continue;
      
      const status = p.items[0]?.status;
      if (!status) continue;
      
      if (status === "In Review") {
        // Find the "Editing" deliverable, since that's what was submitted to reach "In Review"
        const deliverable = currentByKey.get(`${p.id}:Editing`) || null;
        items.push({
          product: p,
          deliverable,
          stage: status,
          itemKey: `${p.id}:${status}-${deliverable?.id || 'none'}`
        });
      } else {
        const deliverable = currentByKey.get(`${p.id}:${status}`);
        if (deliverable && deliverable.decision === "pending") {
          items.push({
            product: p,
            deliverable,
            stage: status,
            itemKey: `${p.id}:${status}-${deliverable.id}`
          });
        }
      }
    }

    // Sort newest first based on submission time (if available), fallback to rank
    return items.sort((a, b) => {
      const timeA = a.deliverable?.submittedAt ? new Date(a.deliverable.submittedAt).getTime() : 0;
      const timeB = b.deliverable?.submittedAt ? new Date(b.deliverable.submittedAt).getTime() : 0;
      if (timeA !== timeB) return timeB - timeA;
      return b.product.rank - a.product.rank;
    });
  }, [products, currentByKey]);

  // Compute the list of reviewed items
  const reviewedItems = useMemo(() => {
    const items: Array<{
      product: Product;
      deliverable: StageDeliverable;
      stage: string;
      itemKey: string;
    }> = [];

    for (const deliverable of currentByKey.values()) {
      if (deliverable.decision !== "pending") {
        const product = products.find(p => p.id === deliverable.productId);
        if (product) {
          items.push({
            product,
            deliverable,
            stage: deliverable.stage,
            itemKey: `${product.id}:${deliverable.stage}-${deliverable.id}`
          });
        }
      }
    }

    // Sort newest first based on reviewedAt
    return items.sort((a, b) => {
      const timeA = a.deliverable.reviewedAt ? new Date(a.deliverable.reviewedAt).getTime() : 0;
      const timeB = b.deliverable.reviewedAt ? new Date(b.deliverable.reviewedAt).getTime() : 0;
      return timeB - timeA;
    });
  }, [products, currentByKey]);

  const matchesFilters = (item: { product: Product; deliverable: StageDeliverable | null; stage: string }) => {
    if (searchQuery && !item.product.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterStage !== "all" && item.stage !== filterStage) return false;
    if (filterOperator !== "all" && item.deliverable?.submittedBy !== filterOperator) return false;
    return true;
  };

  const filteredPendingItems = useMemo(() => pendingItems.filter(matchesFilters), [pendingItems, searchQuery, filterStage, filterOperator]);
  const filteredReviewedItems = useMemo(() => reviewedItems.filter(item => !clearedReviewedIds.has(item.itemKey) && matchesFilters(item)), [reviewedItems, clearedReviewedIds, searchQuery, filterStage, filterOperator]);
  
  const displayedItems = activeTab === "pending" ? filteredPendingItems : filteredReviewedItems;
  const totalPages = Math.ceil(displayedItems.length / itemsPerPage) || 1;
  const paginatedItems = displayedItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const uniqueOperators = useMemo(() => {
    const ops = new Set<string>();
    pendingItems.forEach(i => i.deliverable?.submittedBy && ops.add(i.deliverable.submittedBy));
    reviewedItems.forEach(i => i.deliverable?.submittedBy && ops.add(i.deliverable.submittedBy));
    return Array.from(ops);
  }, [pendingItems, reviewedItems]);

  const uniqueStages = useMemo(() => {
    // Always include standard reviewable stages so the dropdown doesn't feel empty
    const stg = new Set<string>(["Storyboarding", "Scripting", "Prompting", "In Review"]);
    pendingItems.forEach(i => stg.add(i.stage));
    reviewedItems.forEach(i => stg.add(i.stage));
    
    // Sort them in pipeline order roughly
    const order = ["Storyboarding", "Scripting", "Prompting", "Editing", "In Review"];
    return Array.from(stg).sort((a, b) => {
      const idxA = order.indexOf(a);
      const idxB = order.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [pendingItems, reviewedItems]);

  const unhiddenReviewedItemsCount = useMemo(() => {
    return reviewedItems.filter(item => !clearedReviewedIds.has(item.itemKey)).length;
  }, [reviewedItems, clearedReviewedIds]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Approvals Inbox"
        overline="ACTION ITEMS"
        subtitle="Pending deliverables that require your QA/QC approval."
      />

      <div className="panel panel-glass p-0 overflow-hidden flex flex-col">
        <div className="flex border-b border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]">
          <button
            className={`flex-1 py-3 text-sm font-semibold transition-colors border-b-2 ${
              activeTab === "pending"
                ? "text-amber-600 dark:text-amber-500 border-amber-500 bg-black/[0.04] dark:bg-white/[0.04]"
                : "text-secondary hover:text-primary hover:bg-black/[0.02] dark:hover:bg-white/[0.02] border-transparent"
            }`}
            onClick={() => setActiveTab("pending")}
          >
            Pending ({pendingItems.length})
          </button>
          <button
            className={`flex-1 py-3 text-sm font-semibold transition-colors border-b-2 ${
              activeTab === "reviewed"
                ? "text-green-600 dark:text-green-500 border-green-500 bg-black/[0.04] dark:bg-white/[0.04]"
                : "text-secondary hover:text-primary hover:bg-black/[0.02] dark:hover:bg-white/[0.02] border-transparent"
            }`}
            onClick={() => {
              setActiveTab("reviewed");
              setExpandedReviewedId(null);
            }}
          >
            Reviewed ({unhiddenReviewedItemsCount})
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-3 border-b border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01]">
          <div className="flex items-center gap-3 flex-1 min-w-[300px]">
            {activeTab === "reviewed" && (
              <div className="flex items-center gap-1 pr-3 border-r border-black/10 dark:border-white/10">
                <button 
                  onClick={() => {
                    if (selectedReviewedIds.size === filteredReviewedItems.length && filteredReviewedItems.length > 0) {
                      setSelectedReviewedIds(new Set());
                    } else {
                      const allIds = new Set(filteredReviewedItems.map(i => i.itemKey));
                      setSelectedReviewedIds(allIds);
                    }
                  }}
                  className="text-secondary hover:text-primary transition-colors p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5"
                  title={selectedReviewedIds.size > 0 ? "Deselect All" : "Select All"}
                >
                  {selectedReviewedIds.size === filteredReviewedItems.length && filteredReviewedItems.length > 0 ? (
                    <CheckSquare size={18} className="text-green-600 dark:text-green-500" />
                  ) : (
                    <Square size={18} />
                  )}
                </button>
                <button 
                  onClick={handleClearSelected}
                  disabled={selectedReviewedIds.size === 0}
                  className="text-secondary hover:text-red-500 transition-colors p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-secondary"
                  title="Clear Selected"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            )}

            <div className="relative flex-1 max-w-[300px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
              <input 
                type="text" 
                placeholder="Search product..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 rounded-md bg-black/[0.03] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 text-sm text-primary placeholder:text-secondary focus:outline-none focus:border-green-500 transition-colors"
              />
            </div>
            
            <select 
              value={filterOperator}
              onChange={e => setFilterOperator(e.target.value)}
              className="px-3 py-1.5 rounded-md bg-black/[0.03] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 text-sm text-primary focus:outline-none focus:border-green-500 transition-colors max-w-[150px]"
            >
              <option value="all">All Operators</option>
              {uniqueOperators.map(opId => {
                const profile = profiles.find(p => p.id === opId);
                return <option key={opId} value={opId}>{profile?.email?.split('@')[0] || "Unknown"}</option>
              })}
            </select>
            
            <select 
              value={filterStage}
              onChange={e => setFilterStage(e.target.value)}
              className="px-3 py-1.5 rounded-md bg-black/[0.03] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 text-sm text-primary focus:outline-none focus:border-green-500 transition-colors max-w-[150px]"
            >
              <option value="all">All Stages</option>
              {uniqueStages.map(stg => (
                <option key={stg} value={stg}>{stg}</option>
              ))}
            </select>
          </div>
          
          {activeTab === "reviewed" && selectedReviewedIds.size > 0 && (
            <div className="text-xs text-secondary font-medium pr-2">
              {selectedReviewedIds.size} selected
            </div>
          )}
        </div>

        <AnimatePresence mode="wait">
          {displayedItems.length === 0 ? (
            <motion.div 
              key={`empty-${activeTab}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="p-12 text-center text-secondary"
            >
              <p className="text-lg font-medium mb-2">
                {activeTab === "pending" ? "Inbox Zero! 🎉" : "No reviewed items yet."}
              </p>
              <p className="text-sm">
                {activeTab === "pending"
                  ? "No pending deliverables require your attention right now."
                  : "Deliverables you have accepted or rejected will appear here."}
              </p>
            </motion.div>
          ) : (
              <motion.div 
              key={`list-${activeTab}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col divide-y divide-black/5 dark:divide-white/5"
            >
              {paginatedItems.map((item) => {
                const isPending = activeTab === "pending";
                // For pending, it's unread if not clicked. For reviewed, it's always read.
                const isUnread = isPending ? !clickedItemKeys.has(item.itemKey) : false;
                const profile = item.deliverable?.submittedBy ? profiles.find(p => p.id === item.deliverable?.submittedBy) : null;
                const senderName = profile?.email || "Unknown Operator";
                
                // E.g. "Editing for The Bucky Challenge"
                const subject = `${item.stage} for ${item.product.name}`;
                const isExpanded = expandedReviewedId === item.itemKey;

                return (
                  <div key={item.itemKey} className="flex flex-col group">
                    <div 
                      onClick={() => {
                        if (isPending) {
                          handleItemClick(item.product.rank, item.itemKey);
                        } else {
                          setExpandedReviewedId(isExpanded ? null : item.itemKey);
                        }
                      }}
                      className={`flex items-center gap-4 p-4 cursor-pointer transition-all duration-200 border-l-4 ${
                        isPending 
                          ? `hover:bg-amber-500/5 hover:border-amber-500/50 ${isUnread ? "bg-surface/50 border-transparent" : "border-transparent"}`
                          : isExpanded
                            ? "bg-green-500/5 border-green-500 shadow-[inset_0_0_20px_rgba(34,197,94,0.05)]"
                            : "hover:bg-surface/50 border-transparent"
                      }`}
                    >
                      {/* Checkbox for Reviewed tab */}
                      {!isPending && (
                        <div className="shrink-0 pl-2">
                          <input 
                            type="checkbox" 
                            checked={selectedReviewedIds.has(item.itemKey)}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              setSelectedReviewedIds(prev => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(item.itemKey);
                                else next.delete(item.itemKey);
                                return next;
                              });
                            }}
                            className="w-4 h-4 rounded border-black/20 dark:border-white/20 bg-black/5 dark:bg-white/5 text-green-500 focus:ring-green-500 focus:ring-offset-0 cursor-pointer transition-colors"
                          />
                        </div>
                      )}

                      {/* Read/Unread Indicator & Sender */}
                      <div className="w-[180px] shrink-0 flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${isUnread ? "bg-amber-500" : "opacity-0"}`} />
                        <div className="flex items-center gap-2 truncate">
                          <div className="w-6 h-6 rounded-full shrink-0 bg-black/10 dark:bg-white/10 flex items-center justify-center text-[10px] font-bold text-secondary">
                            {senderName.charAt(0).toUpperCase()}
                          </div>
                          <span className={`truncate text-sm ${isUnread ? "text-primary font-bold" : "text-secondary font-medium"}`}>
                            {senderName.split('@')[0]}
                          </span>
                        </div>
                      </div>

                      {/* Subject */}
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <span className={`truncate text-sm ${isUnread ? "text-primary font-semibold" : "text-secondary"}`}>
                          {subject}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-surface text-secondary shrink-0">
                          {item.product.category}
                        </span>
                        {!isPending && item.deliverable?.decision && (
                          <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 font-medium ${
                            item.deliverable.decision === "accepted" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                          }`}>
                            {item.deliverable.decision.toUpperCase()}
                          </span>
                        )}
                      </div>

                      {/* Timestamp & Action */}
                      <div className="shrink-0 flex items-center gap-4">
                        <span className={`text-xs w-[100px] text-right ${isUnread ? "text-primary font-medium" : "text-secondary"}`}>
                          {timeAgo(isPending ? item.deliverable?.submittedAt : item.deliverable?.reviewedAt)}
                        </span>
                        {isPending && (
                          <button 
                            className="btn btn-primary btn-sm opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleItemClick(item.product.rank, item.itemKey);
                            }}
                          >
                            Review
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expanded View for Reviewed Items */}
                    <AnimatePresence>
                      {isExpanded && !isPending && item.deliverable && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: "easeInOut" }}
                          className="overflow-hidden"
                        >
                          <div className="p-6 bg-green-500/[0.02] border-t border-black/5 dark:border-white/5 pl-[232px]">
                            <div className="flex flex-col gap-4 max-w-3xl">
                              <div>
                                <h4 className="text-sm font-semibold text-primary mb-1">Decision Note</h4>
                                <p className="text-sm text-secondary bg-black/5 dark:bg-white/5 p-3 rounded-md whitespace-pre-wrap">
                                  {item.deliverable.decisionNote || <span className="italic opacity-50">No note provided</span>}
                                </p>
                              </div>
                              
                              <div>
                                <h4 className="text-sm font-semibold text-primary mb-1">Deliverable Content</h4>
                                <div className="text-sm text-secondary bg-black/5 dark:bg-white/5 p-3 rounded-md">
                                  {item.deliverable.kind === "text" ? (
                                    <p className="whitespace-pre-wrap">{item.deliverable.textContent}</p>
                                  ) : item.deliverable.fileUrl ? (
                                    <a 
                                      href={item.deliverable.fileUrl} 
                                      target="_blank" 
                                      rel="noreferrer"
                                      className="text-accent hover:underline inline-flex items-center gap-2"
                                    >
                                      📄 View Submitted Document
                                    </a>
                                  ) : (
                                    <span className="italic opacity-50">No file attached</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01]">
            <span className="text-xs text-secondary">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, displayedItems.length)} of {displayedItems.length} entries
            </span>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded-md hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm font-medium text-primary px-2">{currentPage} / {totalPages}</span>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1 rounded-md hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
