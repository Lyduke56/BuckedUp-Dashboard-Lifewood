"use client";

import { useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Bot, Send, X } from "lucide-react";
import { useMounted } from "@/lib/useMounted";

interface ChatMessage {
  from: "bucky" | "user";
  text: string;
}

const GREETING: ChatMessage = {
  from: "bucky",
  text: "Hi, I'm Bucky. Ask me about the pipeline, or tell me what you'd like to do — I can help you operate the dashboard.",
};

// UI-only assistant for admins. No LLM/backend is wired yet — Bucky replies
// with a canned acknowledgement so the interaction surface exists and can
// be connected to a real agent later. Presentational only; state resets on
// close/reload.
export function BuckyWidget() {
  const mounted = useMounted();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [draft, setDraft] = useState("");

  const send = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    setMessages((prev) => [...prev, { from: "user", text }]);
    // Canned response (no real agent yet).
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          from: "bucky",
          text: "I'm still learning the ropes — a real assistant will be wired up here soon. For now, try the tabs above to navigate the dashboard.",
        },
      ]);
    }, 500);
  };

  if (!mounted) return null;

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
            {messages.map((message, index) => (
              <div key={index} className={`bucky-msg bucky-msg-${message.from}`}>
                {message.text}
              </div>
            ))}
          </div>

          <form className="bucky-input-row" onSubmit={send}>
            <input
              type="text"
              className="bucky-input"
              placeholder="Ask Bucky…"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <button type="submit" className="bucky-send" aria-label="Send" disabled={!draft.trim()}>
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
