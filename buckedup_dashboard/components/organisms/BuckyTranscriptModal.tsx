"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { User } from "lucide-react";
import { isToolUIPart, type UIMessage } from "ai";
import { useMounted } from "@/lib/useMounted";
import { createClient } from "@/lib/supabase/client";
import { loadChatHistory } from "@/lib/bucky/chatHistory";
import { renderMarkdown, isLeakedReasoning, extractVerifiedTables, substituteVerifiedTables } from "@/lib/bucky/renderMarkdown";
import { describeAction, describeToolResult } from "@/lib/bucky/toolCopy";

interface BuckyTranscriptModalProps {
  userId: string;
  userEmail: string;
  onClose: () => void;
}

// Read-only replay of a saved Bucky conversation, for admins. Mirrors
// BuckyWidget.tsx's per-part rendering (text/tool-call branches) using the
// same shared renderMarkdown/toolCopy modules, but strips everything that
// only makes sense in a LIVE conversation: no Confirm/Cancel buttons, no
// busy/typing indicator, no input box. A saved message should never still
// be in "approval-requested" (the debounced save always fires after a
// decision is made), but it's handled defensively rather than assumed.
export function BuckyTranscriptModal({ userId, userEmail, onClose }: BuckyTranscriptModalProps) {
  const mounted = useMounted();
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const history = await loadChatHistory(supabase, userId);
      if (!cancelled) {
        setMessages(history);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="overlay show"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
      role="presentation"
    >
      <div className="modal video-modal-wide">
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close modal">
          ✕
        </button>

        <div style={{ padding: "24px" }}>
          <div style={{ fontSize: "20px", fontWeight: 800, marginBottom: "4px" }}>
            {userEmail}&rsquo;s conversation with Bucky
          </div>
          <div style={{ fontSize: "13px", opacity: 0.7, marginBottom: "20px" }}>
            {loading ? "Loading…" : `${messages.length} message${messages.length === 1 ? "" : "s"}`}
          </div>

          {loading ? (
            <div className="empty-state">Loading conversation…</div>
          ) : messages.length === 0 ? (
            <div className="empty-state">No messages saved for this user.</div>
          ) : (
            <div className="bucky-messages" style={{ maxHeight: "65vh", overflowY: "auto" }}>
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
                          {isUser ? (
                            <User size={16} />
                          ) : (
                            <Image
                              src="/bucky_default.svg"
                              width={32}
                              height={32}
                              alt="Bucky"
                              className="rounded-full w-full h-full object-cover pointer-events-none bg-white"
                              draggable={false}
                            />
                          )}
                        </div>
                        <div className={`bucky-msg bucky-msg-${isUser ? "user" : "bucky"}`}>
                          {isUser
                            ? part.text
                            : renderMarkdown(substituteVerifiedTables(part.text, extractVerifiedTables(message)))}
                        </div>
                      </div>
                    );
                  }
                  if (isToolUIPart(part)) {
                    const toolName =
                      part.type === "dynamic-tool" ? part.toolName : part.type.slice("tool-".length);
                    if (part.state === "approval-requested") {
                      return (
                        <div key={key} className="bucky-msg-tool">
                          {describeAction(toolName, part.input)} (conversation ended before this was resolved)
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
                    return null;
                  }
                  return null;
                }),
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
