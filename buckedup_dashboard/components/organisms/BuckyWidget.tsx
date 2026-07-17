"use client";

import { useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Bot, Send, X, User, Loader2, Trash2 } from "lucide-react";
import Image from "next/image";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart, type UIMessage } from "ai";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { useMounted } from "@/lib/useMounted";
import { useAuth } from "@/lib/useAuth";
import { createClient } from "@/lib/supabase/client";
import { useStageAge } from "@/lib/useStageAge";
import { useProductionPlan } from "@/lib/useProductionPlan";
import { useDailyProgress } from "@/lib/useDailyProgress";
import { DAILY_VIDEO_TARGET } from "@/lib/data";
import type { Product, UserRole, ViewId } from "@/lib/types";
import type { BuckyCatalogContext, BuckyProductContext } from "@/lib/bucky/systemPrompt";
import { motion, useDragControls, useMotionValue, animate, type PanInfo, AnimatePresence, useAnimation } from "framer-motion";
import { useEffect, useRef } from "react";

// How many days a product can sit in its current stage before the
// proactive-alert check (see the alert effect below) flags it as stale.
const STALE_DAYS_THRESHOLD = 3;

const GREETING =
  "Hi, I'm Bucky. Ask me anything about the dashboard — what's in production, today's output, open issues, and more.";

// Empty-state starter chips, tailored per role — every one of these is a
// plain question that works standalone with no editing needed, since
// clicking a chip sends it immediately (see the onClick below). Action
// prompts that need a specific product/email filled in are deliberately
// left out of this list, rather than sending a half-finished request.
const SUGGESTIONS: Record<UserRole, { label: string; prompt: string }[]> = {
  admin: [
    { label: "What's in production?", prompt: "What's currently in production?" },
    { label: "Who's on the team?", prompt: "Who's on the team, and what are their roles?" },
    { label: "Quick summary", prompt: "Give me a quick summary of where we stand." },
    { label: "Open issues?", prompt: "What issues are currently open?" },
  ],
  lead: [
    { label: "What's in production?", prompt: "What's currently in production?" },
    { label: "Deliverables to review?", prompt: "What deliverables are waiting on review right now?" },
    { label: "Today's output", prompt: "How many videos did we publish today?" },
    { label: "Production plan", prompt: "What's our current production plan and deadline?" },
  ],
  operator: [
    { label: "What's in production?", prompt: "What's currently in production?" },
    { label: "Open issues?", prompt: "What issues are currently open?" },
    { label: "Today's output", prompt: "How many videos did we publish today?" },
    { label: "Deliverables to review?", prompt: "What deliverables are waiting on review right now?" },
  ],
};

// The model naturally reaches for markdown — bold, bullet lists, and
// especially tables for anything list-shaped ("what's in production").
// Rendering it for real (tables included, via remark-gfm) rather than
// showing the raw "| Rank | Name |" syntax as a wall of text. Only applied
// to Bucky's own messages — user-typed text renders as plain literal text,
// see the isUser check at the call site, so a stray "_" or "*" someone
// types isn't reinterpreted as formatting.
const MARKDOWN_COMPONENTS: Components = {
  table: ({ ...props }) => (
    <div className="bucky-table-wrap">
      <table {...props} />
    </div>
  ),
  a: ({ ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
};

function renderMarkdown(text: string) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
      {text}
    </ReactMarkdown>
  );
}

// Some free-tier reasoning models (e.g. gpt-oss) internally separate a
// hidden "analysis"/chain-of-thought channel from the real "final" answer
// using special tokens — when the provider doesn't strip that channel
// correctly, it leaks through as a normal text part (seen live: a bubble
// starting "Expert commentary (analysis)" full of stray ‹...› tokens and
// self-narration like "We need to call tool X"). The system prompt now
// tells the model not to do this, but that's not a guarantee on a free
// model — this is the belt-and-suspenders backstop that drops any text
// part matching the leak pattern entirely, rather than showing it.
function isLeakedReasoning(text: string): boolean {
  return (
    /^expert commentary/i.test(text.trim()) ||
    /[‹›]/.test(text) ||
    /<\|.*?\|>/.test(text) ||
    /\bwe need to call tool\b/i.test(text)
  );
}

// Human-readable summary of a proposed action-tool call, shown in the
// confirm/cancel card before it runs. Falls back to the raw tool name for
// anything not explicitly described here (e.g. if a new action tool gets
// added later without updating this).
function withArticle(word: unknown): string {
  const w = String(word);
  return `${/^[aeiou]/i.test(w) ? "an" : "a"} ${w}`;
}

function describeAction(toolName: string, input: unknown): string {
  const params = (input ?? {}) as Record<string, unknown>;
  const product = params.rank != null ? `#${params.rank}` : String(params.id ?? "that product");
  switch (toolName) {
    case "create_user":
      return `Create ${withArticle(params.role)} account for ${params.email}?`;
    case "delete_user":
      return `Delete ${params.email}'s account? This can't be undone.`;
    case "change_role":
      return `Change ${params.email}'s role to ${params.role}?`;
    case "move_product_stage":
      return `Move ${product} to ${params.newStatus}?`;
    case "review_deliverable":
      return params.decision === "accepted"
        ? `Accept the deliverable for ${product}?`
        : `Reject the deliverable for ${product}?`;
    case "review_video":
      return params.decision === "accepted"
        ? `Accept and PUBLISH ${product}? This makes it publicly live.`
        : `Reject ${product}'s video back to Editing?`;
    case "create_product":
      return typeof params.name === "string"
        ? `Create a new product "${params.name}"?`
        : params.catalogProductId
          ? "Create a new product from the selected catalog item?"
          : "Create a new product?";
    case "delete_product":
      return `Delete ${product}? This can't be undone and removes all its issues, deliverables, and version history.`;
    case "update_production_plan":
      return `Update the production plan${typeof params.name === "string" ? ` "${params.name}"` : ""}?`;
    case "create_or_update_catalog_product":
      return `${params.id ? "Update" : "Create"} the catalog product${typeof params.name === "string" ? ` "${params.name}"` : ""}?`;
    case "delete_catalog_product":
      return `Delete the catalog product${typeof params.name === "string" ? ` "${params.name}"` : ""}? This can't be undone — any linked video stays, just unlinked.`;
    default:
      return `Run ${toolName}?`;
  }
}

// Human-readable summary of a tool's completed result, shown as the
// <summary> of the collapsible output-available block. Read tools (list_*,
// get_*) have no entry here and fall back to "Looked up {toolName}" —
// accurate for them. Mutation tools that don't require approval (operator's
// work-execution tools, see lib/bucky/tools/operator.ts) get a past-tense summary
// instead, since "Looked up submit_deliverable" reads oddly for something
// that just *did* something rather than fetched data.
function describeToolResult(toolName: string, input: unknown): string {
  const params = (input ?? {}) as Record<string, unknown>;
  const product = typeof params.rank === "number" ? `#${params.rank}` : "a product";
  switch (toolName) {
    case "report_issue": {
      const severity = typeof params.severity === "string" ? params.severity : "medium";
      return `Reported ${withArticle(severity)} issue on #${params.rank}`;
    }
    case "resolve_issue":
      return "Resolved an issue";
    case "claim_product":
      return `Claimed ${product}`;
    case "submit_deliverable":
      return `Submitted a deliverable for ${product}`;
    case "submit_video_for_review":
      return `Submitted ${product} for review`;
    case "set_video_version":
      return `Set a new video version for ${product}`;
    case "create_user":
      return `Created ${withArticle(typeof params.role === "string" ? params.role : "user")} account`;
    case "delete_user":
      return "Deleted a user account";
    case "change_role":
      return `Changed a user's role to ${params.role}`;
    case "move_product_stage":
      return `Moved ${product} to ${typeof params.newStatus === "string" ? params.newStatus : "a new stage"}`;
    case "review_deliverable":
      return params.decision === "accepted"
        ? `Accepted the deliverable for ${product}`
        : `Rejected the deliverable for ${product}`;
    case "review_video":
      return params.decision === "accepted" ? `Published ${product}` : `Rejected ${product}'s video back to Editing`;
    case "create_product":
      return typeof params.name === "string" ? `Created "${params.name}"` : "Created a new product";
    case "delete_product":
      return `Deleted ${product}`;
    case "update_production_plan":
      return "Updated the production plan";
    case "create_or_update_catalog_product":
      return params.id ? "Updated a catalog product" : "Created a catalog product";
    case "delete_catalog_product":
      return "Deleted a catalog product";
    default:
      return `Looked up ${toolName}`;
  }
}

// Only auto-resubmit after an approval decision if something was actually
// *approved* — a denial needs no further model round-trip (nothing ran,
// nothing to report on), and the built-in
// lastAssistantMessageIsCompleteWithApprovalResponses helper resubmits on
// any response including an all-denied one. That round-trip measured up
// to 70+s on the free-tier model in testing, leaving the input disabled
// that whole time for zero benefit — skipping it makes "Cancel" instant
// and costs nothing.
function shouldAutoResubmitAfterApproval({ messages }: { messages: UIMessage[] }): boolean {
  const last = messages[messages.length - 1];
  if (!last || last.role !== "assistant") return false;
  const approvals = last.parts.filter(
    (part) => isToolUIPart(part) && (part.state === "approval-requested" || part.state === "approval-responded"),
  );
  if (approvals.length === 0) return false;
  const allResponded = approvals.every((part) => isToolUIPart(part) && part.state === "approval-responded");
  if (!allResponded) return false;
  return approvals.some(
    (part) => isToolUIPart(part) && part.state === "approval-responded" && part.approval.approved,
  );
}

// Available to every authenticated role, wired to a real tool-calling
// backend (app/api/bucky/chat/route.ts). Can answer questions about any
// dashboard data for anyone. Admins additionally get three
// account-management actions (create/delete/change role); operators get six
// self-scoped work-execution tools that run immediately; leads get ten
// pipeline/catalog/plan-management tools — issue report/resolve run
// immediately like operator's, the other eight (stage moves, deliverable/
// video review, product/catalog CRUD, plan edits) require an explicit
// confirm click here before they run. Conversation history persists to
// localStorage per-user (see the load/save effects below), so it survives
// a reload — use the header's clear-conversation button to start fresh.
// Lead/operator also get proactive alerts (stale items, pacing behind
// target) posted unprompted on dashboard load — see the alert effect below.
export function BuckyWidget({
  activeView,
  currentProduct,
  currentCatalogProduct,
  products,
}: {
  activeView: ViewId;
  currentProduct: BuckyProductContext | null;
  currentCatalogProduct: BuckyCatalogContext | null;
  products: Product[];
}) {
  const mounted = useMounted();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [corner, setCorner] = useState("bottom-right");
  const dragControls = useDragControls();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const iconControls = useAnimation();

  const handleDragEnd = (_event: any, info: PanInfo) => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const isTop = info.point.y < cy;
    const isLeft = info.point.x < cx;
    setCorner(`${isTop ? "top" : "bottom"}-${isLeft ? "left" : "right"}`);

    animate(x, 0, { type: "spring", bounce: 0.2, duration: 0.6 });
    animate(y, 0, { type: "spring", bounce: 0.2, duration: 0.6 });
  };

  const { user, role } = useAuth();
  const { stageAgeByProductId } = useStageAge();
  const { plan } = useProductionPlan();
  const dailyProgress = useDailyProgress(plan?.startDate, plan?.dailyAccumulativeTargets);

  const { messages, sendMessage, status, addToolApprovalResponse, setMessages } = useChat({
    // body is re-resolved on every send (useChat proxies to the transport
    // built on the widget's most recent render), so activeView always
    // reflects whichever tab the user is on when a message is actually
    // sent, not just whichever tab was active on mount.
    transport: new DefaultChatTransport({
      api: "/api/bucky/chat",
      body: { activeView, currentProduct, currentCatalogProduct },
    }),
    // Auto-resubmit once the admin has approved every pending approval in
    // the last turn, so confirming doesn't need a separate "send" click.
    // Denials are handled locally without a round-trip — see the comment
    // on shouldAutoResubmitAfterApproval above.
    sendAutomaticallyWhen: shouldAutoResubmitAfterApproval,
  });

  const busy = status === "submitted" || status === "streaming";
  const prevBusy = useRef(busy);
  const [hasUnread, setHasUnread] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const storageKey = user?.id ? `bucky-chat-${user.id}` : null;

  // Loads any saved conversation once we know who's logged in. useChat's
  // own `messages` seed option only applies once, at construction inside a
  // useRef — updating it on a later render is silently ignored unless `id`
  // also changes — so this uses setMessages() instead, which correctly
  // notifies useChat's internal state and triggers a re-render.
  const [historyLoaded, setHistoryLoaded] = useState(false);
  useEffect(() => {
    if (!storageKey) return;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch {
        // Corrupted entry — ignore and start fresh rather than crashing.
      }
    }
    setHistoryLoaded(true);
  }, [storageKey, setMessages]);

  // Saves on every conversation change, including a user message sent but
  // not yet answered (not just on response completion), so an early reload
  // mid-stream doesn't lose it. The historyLoaded gate is load-bearing, not
  // just tidy: without it this would fire on the very first render with the
  // fresh Chat instance's empty messages array, before the load effect
  // above has run, and clobber any real saved history with [].
  useEffect(() => {
    if (!storageKey || !historyLoaded) return;
    localStorage.setItem(storageKey, JSON.stringify(messages));
  }, [messages, storageKey, historyLoaded]);

  // Clicking the header trash icon used to clear instantly, which read as
  // ambiguous — easy to mistake for closing/deleting Bucky itself rather
  // than just wiping the chat history. Gating it behind an explicit
  // confirm step (skipped when there's nothing to lose) both prevents an
  // accidental click from destroying an unrecoverable conversation and
  // spells out exactly what's about to happen.
  const [confirmingClear, setConfirmingClear] = useState(false);

  const clearConversation = () => {
    setMessages([]);
    if (storageKey) localStorage.removeItem(storageKey);
    setConfirmingClear(false);
  };

  const requestClearConversation = () => {
    if (messages.length === 0) {
      clearConversation();
      return;
    }
    setConfirmingClear(true);
  };

  // Half of the audit-log picture (see the other half, onToolExecutionEnd,
  // in app/api/bucky/chat/route.ts). A denied tool call never reaches the
  // server at all in the common case — see shouldAutoResubmitAfterApproval
  // above — so this is the only place a denial can ever be recorded.
  // Deliberately fire-and-forget, not awaited before addToolApprovalResponse:
  // Cancel being instant is a previously-tested, deliberate UX property (see
  // the comment on shouldAutoResubmitAfterApproval), and this must not
  // quietly reintroduce a network wait on every Cancel click. Every tool
  // reachable at this button is, by construction, already mutating and
  // already in toolApproval — no metadata import needed client-side.
  const logDenial = (approvalId: string, toolName: string, input: unknown) => {
    if (!user?.id || !role) return;
    // Plain insert, not upsert — PostgREST's upsert(onConflict) path needs
    // broader permissions than a plain insert under RLS (confirmed live:
    // identical insert succeeds via .insert(), fails with 42501 via
    // .upsert() even though the "Own inserts" policy is correct and
    // unrelated to this). A rare double-click just hits the unique index
    // on approval_id and errors with 23505 (duplicate key), which is
    // exactly the "already logged, nothing to do" case — safe to ignore.
    void createClient()
      .from("bucky_audit_log")
      .insert({ approval_id: approvalId, user_id: user.id, role, tool_name: toolName, status: "denied", input: input ?? {} })
      .then(({ error }) => {
        if (error && error.code !== "23505") console.error("bucky-audit-log denial insert failed:", error);
      });
  };

  // Mirrors `messages` every render without being a dependency of the
  // proactive-alert effect below — `messages` changes on every streamed
  // token during a live response, and that effect has no reason to re-run
  // that often. Reading the ref instead gives it the latest transcript
  // (for the dedup check) only when one of its real triggers fires.
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Proactive alerts (Phase 5): surfaces stale in-review/claimed items and
  // pacing-behind-target, unprompted, on dashboard load — not gated on
  // opening the panel. Template-generated, not model-generated, so it
  // costs zero LLM calls; injected straight into the local message array
  // via setMessages, same mechanism Phase 4's history load/clear already
  // use. Dedup is a deterministic message id checked against the
  // already-persisted transcript, so a given alert posts at most once per
  // calendar day — a day with nothing wrong writes no id, so a problem
  // that appears later the same day can still be caught on the next
  // natural re-run of this effect.
  useEffect(() => {
    if (!historyLoaded) return;
    if (role !== "lead" && role !== "operator") return;
    if (!user?.id) return;

    const dateKey = new Date().toISOString().slice(0, 10);
    const existingIds = new Set(messagesRef.current.map((m) => m.id));
    const newAlerts: UIMessage[] = [];

    const staleId = `bucky-alert-stale-${role}-${dateKey}`;
    if (!existingIds.has(staleId)) {
      const stale = products.filter((p) => {
        const item = p.items[0];
        const age = stageAgeByProductId.get(p.id);
        if (!item || !age) return false;
        if (role === "lead") {
          return item.status === "In Review" && age.status === "In Review" && age.days >= STALE_DAYS_THRESHOLD;
        }
        return (
          p.ownerId === user.id &&
          item.status !== "Not Started" &&
          item.status !== "Published" &&
          age.status === item.status &&
          age.days >= STALE_DAYS_THRESHOLD
        );
      });
      if (stale.length > 0) {
        const list = stale
          .slice(0, 5)
          .map((p) => {
            const age = stageAgeByProductId.get(p.id);
            const days = age ? age.days.toFixed(1) : "?";
            const stageNote = role === "operator" ? ` in ${p.items[0]?.status}` : "";
            return `#${p.rank} "${p.name}" (${days}d${stageNote})`;
          })
          .join(", ");
        const text =
          role === "lead"
            ? `Heads up — ${stale.length} item${stale.length === 1 ? " has" : "s have"} been sitting In Review for ${STALE_DAYS_THRESHOLD}+ days: ${list}. Want me to look into any of these?`
            : `Heads up — you have ${stale.length} claimed item${stale.length === 1 ? "" : "s"} that ${stale.length === 1 ? "hasn't" : "haven't"} moved in ${STALE_DAYS_THRESHOLD}+ days: ${list}. Might be worth picking ${stale.length === 1 ? "it" : "those"} back up.`;
        newAlerts.push({ id: staleId, role: "assistant", parts: [{ type: "text", text }] });
      }
    }

    const pacingId = `bucky-alert-pacing-${dateKey}`;
    if (!existingIds.has(pacingId)) {
      const today = dailyProgress[dailyProgress.length - 1];
      if (today) {
        const target = today.target ?? DAILY_VIDEO_TARGET;
        if (today.published < target) {
          const behind = target - today.published;
          const text = `Also — today's pace is behind target: ${today.published} of ${target} videos published so far, ${behind} to go.`;
          newAlerts.push({ id: pacingId, role: "assistant", parts: [{ type: "text", text }] });
        }
      }
    }

    if (newAlerts.length > 0) {
      setMessages((prev) => [...prev, ...newAlerts]);
      if (!open) setHasUnread(true);
    }
  }, [historyLoaded, role, user?.id, products, stageAgeByProductId, dailyProgress, open, setMessages]);

  const send = (event?: FormEvent) => {
    if (event) event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    sendMessage({ text });
  };

  useEffect(() => {
    if (open) {
      setHasUnread(false);
      // Wait a tick for the panel to finish animating open before scrolling
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, status]);

  useEffect(() => {
    if (prevBusy.current && !busy && !open) {
      setHasUnread(true);
    }
    prevBusy.current = busy;
  }, [busy, open]);

  useEffect(() => {
    if (open || busy || hasUnread) {
      iconControls.stop();
      iconControls.set({ rotate: 0, scale: 1, y: 0, x: 0 });
      return;
    }

    let timeout: NodeJS.Timeout;
    const triggerFidget = () => {
      const animations: any[] = [
        { rotate: [0, -8, 8, -5, 5, 0], transition: { duration: 1.2, ease: "easeInOut" } },
        { y: [0, -6, 0, -3, 0], transition: { duration: 1.2, ease: "easeInOut" } },
        { scale: [1, 1.08, 0.95, 1.04, 1], transition: { duration: 1.2, ease: "easeInOut" } },
      ];
      const anim = animations[Math.floor(Math.random() * animations.length)];
      iconControls.start(anim);

      timeout = setTimeout(triggerFidget, Math.random() * 5000 + 4000);
    };

    timeout = setTimeout(triggerFidget, 2500);
    return () => clearTimeout(timeout);
  }, [open, busy, hasUnread, iconControls]);

  if (!mounted) return null;

  return createPortal(
    <motion.div
      layout
      drag
      dragControls={dragControls}
      dragListener={false}
      style={{ x, y }}
      onDragEnd={handleDragEnd}
      className={`bucky-root ${corner}`}
    >
      <AnimatePresence>
        {open ? (
          <motion.div
            className="bucky-panel"
            role="dialog"
            aria-label="Bucky assistant"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
          >
            <div className="bucky-header">
              <div className="bucky-header-title">
                <Bot size={18} />
                Bucky
              </div>
              <div className="bucky-header-actions">
                <button
                  type="button"
                  className="bucky-clear"
                  onClick={requestClearConversation}
                  aria-label="Clear conversation"
                  title="Clear conversation"
                >
                  <Trash2 size={15} />
                </button>
                <button
                  type="button"
                  className="bucky-close"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {confirmingClear ? (
              <div className="bucky-clear-confirm">
                <span>Clear this conversation? This can&apos;t be undone — Bucky itself stays right here.</span>
                <div className="bucky-confirm-actions">
                  <button type="button" className="bucky-confirm-deny" onClick={() => setConfirmingClear(false)}>
                    Cancel
                  </button>
                  <button type="button" className="bucky-confirm-approve" onClick={clearConversation}>
                    Clear
                  </button>
                </div>
              </div>
            ) : null}

            <div className="bucky-messages">
              <div className="bucky-msg-wrapper bucky">
                <div className="bucky-avatar border-none overflow-hidden bg-transparent shadow-none">
                  <Image src="/bucky_default.svg" width={32} height={32} alt="Bucky" className="rounded-full w-full h-full object-cover pointer-events-none bg-white" draggable={false} />
                </div>
                <div className="bucky-msg bucky-msg-bucky">{GREETING}</div>
              </div>

              {messages.map((message) =>
                message.parts.map((part, partIndex) => {
                  const key = `${message.id}-${partIndex}`;
                  if (part.type === "text") {
                    if (message.role === "assistant" && isLeakedReasoning(part.text)) {
                      return null;
                    }
                    const isUser = message.role === "user";
                    return (
                      <div key={key} className={`bucky-msg-wrapper ${isUser ? "user" : "bucky"}`}>
                        <div className="bucky-avatar border-none overflow-hidden bg-transparent shadow-none">
                          {isUser ? <User size={16} /> : <Image src="/bucky_default.svg" width={32} height={32} alt="Bucky" className="rounded-full w-full h-full object-cover pointer-events-none bg-white" draggable={false} />}
                        </div>
                        <div className={`bucky-msg bucky-msg-${isUser ? "user" : "bucky"}`}>
                          {isUser ? part.text : renderMarkdown(part.text)}
                        </div>
                      </div>
                    );
                  }
                  if (isToolUIPart(part)) {
                    const toolName =
                      part.type === "dynamic-tool" ? part.toolName : part.type.slice("tool-".length);
                    if (part.state === "approval-requested") {
                      return (
                        <div key={key} className="bucky-confirm">
                          <div>{describeAction(toolName, part.input)}</div>
                          <div className="bucky-confirm-actions">
                            <button
                              type="button"
                              className="bucky-confirm-deny"
                              onClick={() => {
                                logDenial(part.approval.id, toolName, part.input);
                                addToolApprovalResponse({ id: part.approval.id, approved: false });
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              className="bucky-confirm-approve"
                              onClick={() =>
                                addToolApprovalResponse({ id: part.approval.id, approved: true })
                              }
                            >
                              Confirm
                            </button>
                          </div>
                        </div>
                      );
                    }
                    if (part.state === "approval-responded") {
                      return (
                        <div key={key} className="bucky-msg-tool">
                          {part.approval.approved ? "Confirmed" : "Cancelled"} — {describeAction(toolName, part.input)}
                        </div>
                      );
                    }
                    if (part.state === "output-available") {
                      return (
                        <details key={key} className="bucky-tool-json">
                          <summary>{describeToolResult(toolName, part.input)}</summary>
                          <pre>{JSON.stringify(part.output, null, 2)}</pre>
                        </details>
                      );
                    }
                    if (part.state === "output-error") {
                      return (
                        <div key={key} className="bucky-msg-tool">
                          {toolName} failed: {part.errorText}
                        </div>
                      );
                    }
                    return (
                      <div key={key} className="bucky-msg-tool">
                        Checking {toolName}…
                      </div>
                    );
                  }
                  return null;
                }),
              )}

              {busy ? (
                <div className="bucky-msg-wrapper bucky">
                  <div className="bucky-avatar border-none overflow-hidden bg-transparent shadow-none">
                    <motion.div animate={{ y: [0, -1, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }} className="w-full h-full">
                      <Image src="/bucky_loading.svg" width={32} height={32} alt="Bucky Loading" className="rounded-full w-full h-full object-cover pointer-events-none bg-white" draggable={false} />
                    </motion.div>
                  </div>
                  <div className="bucky-msg bucky-msg-bucky bucky-typing">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              ) : null}
              {status === "error" ? (
                <div className="bucky-msg-tool">Something went wrong — try again.</div>
              ) : null}
              <div ref={messagesEndRef} />
            </div>

            {historyLoaded && messages.length === 0 && !busy && role ? (
              <div className="bucky-suggestions">
                {SUGGESTIONS[role].map(({ label, prompt }) => (
                  <button
                    key={label}
                    type="button"
                    className="bucky-chip"
                    onClick={() => sendMessage({ text: prompt })}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}

            <form className="bucky-input-row" onSubmit={send}>
              <textarea
                ref={textareaRef}
                className="bucky-input"
                placeholder="Ask Bucky…"
                value={draft}
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                onChange={(event) => {
                  setDraft(event.target.value);
                  event.target.style.height = 'auto';
                  event.target.style.height = `${event.target.scrollHeight}px`;
                }}
                disabled={busy}
              />
              <button
                type="submit"
                className="bucky-send"
                aria-label="Send"
                disabled={!draft.trim() || busy}
              >
                <Send size={15} />
              </button>
            </form>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.button
        type="button"
        className="bucky-fab"
        style={{ background: 'transparent', boxShadow: 'none', border: 'none' }}
        animate={iconControls}
        whileHover={{ y: -4, scale: 1.05 }}
        onPointerDown={(e) => dragControls.start(e)}
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? "Close Bucky" : "Open Bucky"}
      >
        <div 
          className="absolute inset-[-6px] rounded-full border-[3px] border-transparent border-t-[var(--saffron)] border-l-[var(--saffron)] opacity-80 pointer-events-none animate-spin"
          style={{ animationDuration: busy ? '3s' : '12s' }}
        />
        <div 
          className="absolute inset-[-12px] rounded-full border-[2px] border-dashed border-[var(--saffron)] opacity-40 pointer-events-none animate-[spin_1s_linear_infinite_reverse]"
          style={{ animationDuration: busy ? '8s' : '24s' }}
        />

        <AnimatePresence>
          {hasUnread && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute top-1 right-1 w-3.5 h-3.5 bg-red-500 rounded-full z-10 shadow-[0_0_8px_rgba(239,68,68,0.8)] border-2 border-[rgba(255,159,28,1)]"
            />
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {open ? (
            <motion.div key="close" className="w-full h-full relative pointer-events-none" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <Image src="/bucky_query.svg" alt="Bucky Query" width={56} height={56} className="rounded-full object-cover w-full h-full absolute inset-0 pointer-events-none bg-white" draggable={false} />
            </motion.div>
          ) : busy ? (
            <motion.div key="busy" className="w-full h-full relative pointer-events-none" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} transition={{ duration: 0.15 }}>
              <motion.div animate={{ y: [0, -3, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }} className="w-full h-full absolute inset-0">
                <Image src="/bucky_loading.svg" alt="Bucky Loading" width={56} height={56} className="rounded-full object-cover w-full h-full absolute inset-0 pointer-events-none bg-white" draggable={false} />
              </motion.div>
            </motion.div>
          ) : (
            <motion.div key="bot" className="w-full h-full relative pointer-events-none" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} transition={{ duration: 0.15 }}>
              <Image src="/bucky_default.svg" alt="Bucky Default" width={56} height={56} className="rounded-full object-cover w-full h-full absolute inset-0 pointer-events-none bg-white" draggable={false} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </motion.div>,
    document.body,
  );
}
