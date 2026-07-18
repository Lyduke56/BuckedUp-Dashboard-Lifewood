import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// The model naturally reaches for markdown — bold, bullet lists, and
// especially tables for anything list-shaped ("what's in production").
// Rendering it for real (tables included, via remark-gfm) rather than
// showing the raw "| Rank | Name |" syntax as a wall of text. Only applied
// to Bucky's own messages — user-typed text renders as plain literal text,
// see the isUser check at call sites, so a stray "_" or "*" someone types
// isn't reinterpreted as formatting.
const MARKDOWN_COMPONENTS: Components = {
  table: ({ ...props }) => (
    <div className="bucky-table-wrap">
      <table {...props} />
    </div>
  ),
  a: ({ ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
};

export function renderMarkdown(text: string) {
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
export function isLeakedReasoning(text: string): boolean {
  return (
    /^expert commentary/i.test(text.trim()) ||
    /[‹›]/.test(text) ||
    /<\|.*?\|>/.test(text) ||
    /\bwe need to call tool\b/i.test(text)
  );
}
