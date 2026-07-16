"use client";

import { useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Bot, Send, X, User, Loader2 } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart, type UIMessage } from "ai";
import { useMounted } from "@/lib/useMounted";
import { motion, useDragControls, useMotionValue, animate, type PanInfo, AnimatePresence, useAnimation } from "framer-motion";
import { useEffect, useRef } from "react";

const GREETING =
  "Hi, I'm Bucky. Ask me anything about the dashboard — what's in production, today's output, open issues, and more.";

// The model tends to answer with **bold** markdown around key numbers/
// names — render that as actual emphasis rather than literal asterisks,
// without pulling in a full markdown parser for just this one case.
function renderInlineMarkdown(text: string) {
  const segments = text.split(/(\*\*[^*]+\*\*)/g);
  return segments.map((segment, index) =>
    segment.startsWith("**") && segment.endsWith("**") ? (
      <strong key={index}>{segment.slice(2, -2)}</strong>
    ) : (
      segment
    ),
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
  switch (toolName) {
    case "create_user":
      return `Create ${withArticle(params.role)} account for ${params.email}?`;
    case "delete_user":
      return `Delete ${params.email}'s account? This can't be undone.`;
    case "change_role":
      return `Change ${params.email}'s role to ${params.role}?`;
    default:
      return `Run ${toolName}?`;
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

// Admin-only assistant, wired to a real tool-calling backend
// (app/api/bucky/chat/route.ts). Can answer questions about any dashboard
// data and take three account-management actions (create/delete/change
// role) — each requires an explicit confirm click here before it runs.
// State resets on close/reload (no persisted chat history yet).
export function BuckyWidget() {
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

  const { messages, sendMessage, status, addToolApprovalResponse } = useChat({
    transport: new DefaultChatTransport({ api: "/api/bucky/chat" }),
    // Auto-resubmit once the admin has approved every pending approval in
    // the last turn, so confirming doesn't need a separate "send" click.
    // Denials are handled locally without a round-trip — see the comment
    // on shouldAutoResubmitAfterApproval above.
    sendAutomaticallyWhen: shouldAutoResubmitAfterApproval,
  });

  const send = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    sendMessage({ text });
  };

  const busy = status === "submitted" || status === "streaming";
  const prevBusy = useRef(busy);
  const [hasUnread, setHasUnread] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      const animations = [
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
            <button
              type="button"
              className="bucky-close"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          <div className="bucky-messages">
            <div className="bucky-msg-wrapper bucky">
              <div className="bucky-avatar">
                <Bot size={16} />
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
                      <div className="bucky-avatar">
                        {isUser ? <User size={16} /> : <Bot size={16} />}
                      </div>
                      <div className={`bucky-msg bucky-msg-${isUser ? "user" : "bucky"}`}>
                        {renderInlineMarkdown(part.text)}
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
                            onClick={() =>
                              addToolApprovalResponse({ id: part.approval.id, approved: false })
                            }
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
                        <summary>Looked up {toolName}</summary>
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
                <div className="bucky-avatar">
                  <Bot size={16} />
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

          {messages.length === 0 && !busy ? (
            <div className="bucky-suggestions">
              <button type="button" className="bucky-chip" onClick={() => sendMessage({ text: "What's in production?" })}>
                What&apos;s in production?
              </button>
              <button type="button" className="bucky-chip" onClick={() => sendMessage({ text: "Are there any open issues?" })}>
                Open issues?
              </button>
            </div>
          ) : null}

          <form className="bucky-input-row" onSubmit={send}>
            <input
              type="text"
              className="bucky-input"
              placeholder="Ask Bucky…"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
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
        animate={iconControls}
        whileHover={{ y: -4, scale: 1.05 }}
        onPointerDown={(e) => dragControls.start(e)}
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? "Close Bucky" : "Open Bucky"}
      >
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
            <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <X size={22} />
            </motion.div>
          ) : busy ? (
            <motion.div key="busy" className="flex items-center gap-[3px]" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} transition={{ duration: 0.15 }}>
              <motion.div className="w-1.5 h-1.5 bg-current rounded-full" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0 }} />
              <motion.div className="w-1.5 h-1.5 bg-current rounded-full" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.15 }} />
              <motion.div className="w-1.5 h-1.5 bg-current rounded-full" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.3 }} />
            </motion.div>
          ) : (
            <motion.div key="bot" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} transition={{ duration: 0.15 }}>
              <Bot size={22} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </motion.div>,
    document.body,
  );
}
