"use client";

import { useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Bot, Send, X } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart, type UIMessage } from "ai";
import { useMounted } from "@/lib/useMounted";

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

  if (!mounted) return null;

  const busy = status === "submitted" || status === "streaming";

  return createPortal(
    <div className="bucky-root">
      {open ? (
        <div className="bucky-panel" role="dialog" aria-label="Bucky assistant">
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
            <div className="bucky-msg bucky-msg-bucky">{GREETING}</div>

            {messages.map((message) =>
              message.parts.map((part, partIndex) => {
                const key = `${message.id}-${partIndex}`;
                if (part.type === "text") {
                  return (
                    <div
                      key={key}
                      className={`bucky-msg bucky-msg-${message.role === "user" ? "user" : "bucky"}`}
                    >
                      {renderInlineMarkdown(part.text)}
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

            {busy ? <div className="bucky-msg-tool">Bucky is thinking…</div> : null}
            {status === "error" ? (
              <div className="bucky-msg-tool">Something went wrong — try again.</div>
            ) : null}
          </div>

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
        </div>
      ) : null}

      <button
        type="button"
        className="bucky-fab"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? "Close Bucky" : "Open Bucky"}
      >
        {open ? <X size={22} /> : <Bot size={22} />}
      </button>
    </div>,
    document.body,
  );
}
