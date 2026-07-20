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

type InboxItem = {
  product: Product;
  stage: string;
  itemKey: string;
  storyboardDel?: StageDeliverable | null;
  scriptDel?: StageDeliverable | null;
  reviewedAt?: string | null;
  submittedAt?: string | null;
  submittedBy?: string | null;
};

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
    const items: InboxItem[] = [];

    for (const p of products) {
      if (p.deliveryType !== "pipeline") continue;
      
      const status = p.items[0]?.status;
      if (!status) continue;
      
      if (status === "In Review") {
        items.push({
          product: p,
          stage: "In Review",
          itemKey: `${p.id}:In Review`,
          submittedBy: p.ownerId
        });
      } else if (status === "Design") {
        const sb = currentByKey.get(`${p.id}:Storyboarding`) || null;
        const sc = currentByKey.get(`${p.id}:Scripting`) || null;
        if ((sb && sb.decision === "pending") || (sc && sc.decision === "pending")) {
          const sbTime = sb?.submittedAt ? new Date(sb.submittedAt).getTime() : 0;
          const scTime = sc?.submittedAt ? new Date(sc.submittedAt).getTime() : 0;
          const latestSubmit = sbTime > scTime ? sb?.submittedAt : sc?.submittedAt;
          
          items.push({
            product: p,
            stage: "Design",
            itemKey: `${p.id}:Design`,
            storyboardDel: sb,
            scriptDel: sc,
            submittedAt: latestSubmit,
            submittedBy: sb?.submittedBy || sc?.submittedBy,
          });
        }
      }
    }

    // Sort newest first based on submission time (if available), fallback to rank
    return items.sort((a, b) => {
      const timeA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const timeB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      if (timeA !== timeB) return timeB - timeA;
      return b.product.rank - a.product.rank;
    });
  }, [products, currentByKey]);

  // Compute the list of reviewed items
  const reviewedItems = useMemo(() => {
    const items: InboxItem[] = [];

    for (const p of products) {
      if (p.deliveryType !== "pipeline") continue;
      
      // 1. Check historical video reviews
      if (p.reviewStatus === "Accepted" || p.reviewStatus === "Rejected") {
        items.push({
          product: p,
          stage: "In Review",
          itemKey: `${p.id}:In Review-historical`,
          reviewedAt: p.publishDate || p.createdAt,
          submittedBy: p.ownerId,
        });
      }
      
      // 2. Check historical Design reviews
      const sb = currentByKey.get(`${p.id}:Storyboarding`);
      const sc = currentByKey.get(`${p.id}:Scripting`);
      
      const hasReviewedDesign = (sb && sb.decision !== "pending") || (sc && sc.decision !== "pending");
      const isCurrentlyPendingDesign = p.items[0]?.status === "Design" && ((sb && sb.decision === "pending") || (sc && sc.decision === "pending"));
      
      if (hasReviewedDesign && !isCurrentlyPendingDesign) {
         const sbTime = sb?.reviewedAt ? new Date(sb.reviewedAt).getTime() : 0;
         const scTime = sc?.reviewedAt ? new Date(sc.reviewedAt).getTime() : 0;
         const latestReview = sbTime > scTime ? sb?.reviewedAt : sc?.reviewedAt;
         
         items.push({
            product: p,
            stage: "Design",
            itemKey: `${p.id}:Design-historical`,
            storyboardDel: sb,
            scriptDel: sc,
            reviewedAt: latestReview,
            submittedBy: sb?.submittedBy || sc?.submittedBy,
         });
      }
    }

    // Sort newest first based on reviewedAt
    return items.sort((a, b) => {
      const timeA = a.reviewedAt ? new Date(a.reviewedAt).getTime() : 0;
      const timeB = b.reviewedAt ? new Date(b.reviewedAt).getTime() : 0;
      return timeB - timeA;
    });
  }, [products, currentByKey]);

  const matchesFilters = (item: InboxItem) => {
    if (searchQuery && !item.product.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterStage !== "all" && item.stage !== filterStage) return false;
    if (filterOperator !== "all" && item.submittedBy !== filterOperator) return false;
    return true;
  };

  const filteredPendingItems = useMemo(() => pendingItems.filter(matchesFilters), [pendingItems, searchQuery, filterStage, filterOperator]);
  const filteredReviewedItems = useMemo(() => reviewedItems.filter(item => !clearedReviewedIds.has(item.itemKey) && matchesFilters(item)), [reviewedItems, clearedReviewedIds, searchQuery, filterStage, filterOperator]);
  
  const displayedItems = activeTab === "pending" ? filteredPendingItems : filteredReviewedItems;
  const totalPages = Math.ceil(displayedItems.length / itemsPerPage) || 1;
  const paginatedItems = displayedItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const uniqueOperators = useMemo(() => {
    const ops = new Set<string>();
    pendingItems.forEach(i => i.submittedBy && ops.add(i.submittedBy));
    reviewedItems.forEach(i => i.submittedBy && ops.add(i.submittedBy));
    return Array.from(ops);
  }, [pendingItems, reviewedItems]);

  const uniqueStages = useMemo(() => {
    // Always include standard reviewable stages so the dropdown doesn't feel empty
    const stg = new Set<string>(["Design", "In Review"]);
    pendingItems.forEach(i => stg.add(i.stage));
    reviewedItems.forEach(i => stg.add(i.stage));
    
    // Sort them in pipeline order roughly
    const order = ["Design", "In Review"];
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
                : "text-[var(--ink-soft)] hover:text-[var(--text-main)] hover:bg-black/[0.02] dark:hover:bg-white/[0.02] border-transparent"
            }`}
            onClick={() => setActiveTab("pending")}
          >
            Pending ({pendingItems.length})
          </button>
          <button
            className={`flex-1 py-3 text-sm font-semibold transition-colors border-b-2 ${
              activeTab === "reviewed"
                ? "text-green-600 dark:text-green-500 border-green-500 bg-black/[0.04] dark:bg-white/[0.04]"
                : "text-[var(--ink-soft)] hover:text-[var(--text-main)] hover:bg-black/[0.02] dark:hover:bg-white/[0.02] border-transparent"
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
                  className="text-[var(--ink-soft)] hover:text-[var(--text-main)] transition-colors p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5"
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
                  className="text-[var(--ink-soft)] hover:text-red-500 transition-colors p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[var(--ink-soft)]"
                  title="Clear Selected"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            )}

            <div className="relative flex-1 max-w-[300px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]" />
              <input 
                type="text" 
                placeholder="Search product..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 rounded-md bg-black/[0.03] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 text-sm text-[var(--text-main)] placeholder:text-[var(--ink-soft)] focus:outline-none focus:border-green-500 transition-colors"
              />
            </div>
            
            <select 
              value={filterOperator}
              onChange={e => setFilterOperator(e.target.value)}
              className="px-3 py-1.5 rounded-md bg-black/[0.03] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 text-sm text-[var(--text-main)] focus:outline-none focus:border-green-500 transition-colors max-w-[150px]"
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
              className="px-3 py-1.5 rounded-md bg-black/[0.03] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 text-sm text-[var(--text-main)] focus:outline-none focus:border-green-500 transition-colors max-w-[150px]"
            >
              <option value="all">All Stages</option>
              {uniqueStages.map(stg => (
                <option key={stg} value={stg}>{stg}</option>
              ))}
            </select>
          </div>
          
          {activeTab === "reviewed" && selectedReviewedIds.size > 0 && (
            <div className="text-xs text-[var(--ink-soft)] font-medium pr-2">
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
              className="p-12 text-center text-[var(--ink-soft)]"
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
                const profile = item.submittedBy ? profiles.find(p => p.id === item.submittedBy) : null;
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
                          <div className="w-6 h-6 rounded-full shrink-0 bg-black/10 dark:bg-white/10 flex items-center justify-center text-[10px] font-bold text-[var(--ink-soft)]">
                            {senderName.charAt(0).toUpperCase()}
                          </div>
                          <span className={`truncate text-sm ${isUnread ? "text-[var(--text-main)] font-bold" : "text-[var(--ink-soft)] font-medium"}`}>
                            {item.stage === "In Review" ? "Video Review" : `${item.stage} Deliverables`}
                          </span>
                        </div>
                      </div>

                      {/* Product Name */}
                      <div className={`flex-1 truncate text-sm ${isUnread ? "text-[var(--text-main)] font-semibold" : "text-[var(--ink-soft)]"}`}>
                        {item.product.name}
                      </div>

                      {/* Status / Actions / Time */}
                      <div className="w-[150px] shrink-0 flex items-center justify-end gap-4 text-xs">
                        {isPending ? (
                          <div className="flex items-center gap-2">
                            <span className="text-amber-500/80 font-medium whitespace-nowrap">{timeAgo(item.submittedAt)}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-[var(--ink-soft)] whitespace-nowrap">{timeAgo(item.reviewedAt)}</span>
                          </div>
                        )}
                        <button 
                          className={`btn ${isPending ? "btn-primary" : "btn-outline"} px-3 py-1.5 rounded-md text-xs whitespace-nowrap`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleItemClick(item.product.rank, item.itemKey);
                          }}
                        >
                          {isPending ? "Review" : "Details"}
                        </button>
                      </div>
                    </div>

                    {/* Expandable Details for Reviewed Items */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: "easeInOut" }}
                          className="overflow-hidden"
                        >
                          <div className="p-6 bg-green-500/[0.02] border-t border-black/5 dark:border-white/5 pl-[232px]">
                            <div className="mb-6 flex items-center gap-2">
                              <span className="text-xs text-[var(--ink-soft)] font-medium uppercase tracking-wider">Submitted By:</span>
                              <div className="flex items-center gap-2 bg-black/5 dark:bg-white/5 px-2.5 py-1.5 rounded-md">
                                <div className="w-5 h-5 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center text-[10px] font-bold text-[var(--ink-soft)]">
                                  {senderName.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-sm font-medium text-[var(--text-main)]">{senderName}</span>
                              </div>
                            </div>
                            
                            {item.stage === "Design" ? (
                              <div className="flex flex-col gap-6 max-w-3xl">
                                {item.storyboardDel && (
                                  <div>
                                    <h4 className="text-sm font-semibold text-[var(--text-main)] mb-1">Storyboard</h4>
                                    <div className="text-sm text-[var(--ink-soft)] bg-black/5 dark:bg-white/5 p-3 rounded-md">
                                      {item.storyboardDel.kind === "text" ? (
                                        <p className="whitespace-pre-wrap">{item.storyboardDel.textContent}</p>
                                      ) : item.storyboardDel.fileUrl ? (
                                        <a href={item.storyboardDel.fileUrl} target="_blank" rel="noopener noreferrer" className="text-green-500 underline">View File</a>
                                      ) : "No content provided."}
                                    </div>
                                    <div className="mt-2 text-xs">
                                      <span className={`font-semibold ${item.storyboardDel.decision === "accepted" ? "text-green-500" : item.storyboardDel.decision === "rejected" ? "text-red-500" : "text-amber-500"}`}>
                                        Status: {item.storyboardDel.decision}
                                      </span>
                                    </div>
                                  </div>
                                )}
                                {item.scriptDel && (
                                  <div>
                                    <h4 className="text-sm font-semibold text-[var(--text-main)] mb-1">Script</h4>
                                    <div className="text-sm text-[var(--ink-soft)] bg-black/5 dark:bg-white/5 p-3 rounded-md">
                                      {item.scriptDel.kind === "text" ? (
                                        <p className="whitespace-pre-wrap">{item.scriptDel.textContent}</p>
                                      ) : item.scriptDel.fileUrl ? (
                                        <a href={item.scriptDel.fileUrl} target="_blank" rel="noopener noreferrer" className="text-green-500 underline">View File</a>
                                      ) : "No content provided."}
                                    </div>
                                    <div className="mt-2 text-xs">
                                      <span className={`font-semibold ${item.scriptDel.decision === "accepted" ? "text-green-500" : item.scriptDel.decision === "rejected" ? "text-red-500" : "text-amber-500"}`}>
                                        Status: {item.scriptDel.decision}
                                      </span>
                                    </div>
                                  </div>
                                )}
                                {item.storyboardDel?.decisionNote || item.scriptDel?.decisionNote ? (
                                  <div className="pt-4 border-t border-black/5 dark:border-white/5">
                                    <h4 className="text-sm font-semibold text-[var(--text-main)] mb-1">Decision Note</h4>
                                    <p className="text-sm text-[var(--ink-soft)] bg-black/5 dark:bg-white/5 p-3 rounded-md whitespace-pre-wrap">
                                      {item.storyboardDel?.decisionNote || item.scriptDel?.decisionNote}
                                    </p>
                                  </div>
                                ) : null}
                              </div>
                            ) : (
                              <div className="flex flex-col gap-4 max-w-3xl">
                                <div>
                                  <h4 className="text-sm font-semibold text-[var(--text-main)] mb-1">Video Output</h4>
                                  <div className="text-sm text-[var(--ink-soft)] bg-black/5 dark:bg-white/5 p-3 rounded-md">
                                    {item.product.items[0]?.videoUrl ? (
                                      <a href={item.product.items[0].videoUrl} target="_blank" rel="noopener noreferrer" className="text-green-500 underline">View Video File</a>
                                    ) : "No video uploaded."}
                                  </div>
                                </div>
                                {item.product.rejectionReason && (
                                  <div>
                                    <h4 className="text-sm font-semibold text-[var(--text-main)] mb-1">Rejection Note</h4>
                                    <p className="text-sm text-[var(--ink-soft)] bg-black/5 dark:bg-white/5 p-3 rounded-md whitespace-pre-wrap">{item.product.rejectionReason}</p>
                                  </div>
                                )}
                                <div className="text-xs">
                                  <span className={`font-semibold ${item.product.reviewStatus === "Accepted" ? "text-green-500" : item.product.reviewStatus === "Rejected" ? "text-red-500" : "text-amber-500"}`}>
                                    Status: {item.product.reviewStatus || "Pending"}
                                  </span>
                                </div>
                              </div>
                            )}
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
            <span className="text-xs text-[var(--ink-soft)]">
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
              <span className="text-sm font-medium text-[var(--text-main)] px-2">{currentPage} / {totalPages}</span>
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
