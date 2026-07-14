"use client";

import { useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Bot, Send, X } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart } from "ai";
import { useMounted } from "@/lib/useMounted";

const GREETING =
  "Hi, I'm Bucky. Ask me anything about the dashboard — what's in production, today's output, open issues, and more.";

// Admin-only assistant, wired to a real tool-calling backend
// (app/api/bucky/chat/route.ts). Read-only for now: Bucky can answer
// questions about any dashboard data but can't yet create/edit/delete
// anything — see the Bucky plan for the phased rollout. State resets on
// close/reload (no persisted chat history yet).
export function BuckyWidget() {
  const mounted = useMounted();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/bucky/chat" }),
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
                      {part.text}
                    </div>
                  );
                }
                if (isToolUIPart(part)) {
                  const toolName =
                    part.type === "dynamic-tool" ? part.toolName : part.type.slice("tool-".length);
                  if (part.state === "output-available") {
                    return (
                      <div key={key} className="bucky-tool-json">
                        {toolName}: {JSON.stringify(part.output, null, 2)}
                      </div>
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
