import { isValidElement } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { isToolUIPart, type UIMessage } from "ai";

function extractText(node: unknown): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (isValidElement(node)) return extractText((node.props as { children?: unknown }).children);
  return "";
}

// Field names the read tools in lib/bucky/tools/read.ts use for a
// pre-computed, ready-to-paste table (see get_production_breakdown,
// get_issue_summary, etc.).
const TABLE_FIELD_NAMES = ["markdownTable", "activeMarkdownTable"];

// Scans a block of text and returns every contiguous "table" within it (a
// header row immediately followed by a GFM separator row, plus however
// many data rows follow), as exact substrings — regardless of what
// surrounds each one. Used both to pull the known-good tables out of a
// tool's own pre-computed output, and to find the model's (possibly
// garbled) attempt at reproducing them, so the two can be matched up by
// header row and substituted — see substituteVerifiedTables below.
function extractTableBlocks(text: string): string[] {
  const lines = text.split("\n");
  const blocks: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const isHeader = /^\|.*\|$/.test(lines[i].trim());
    const isSeparatorNext = i + 1 < lines.length && /^\|[\s:-]+\|/.test(lines[i + 1].trim());
    if (isHeader && isSeparatorNext) {
      let j = i + 1;
      while (j < lines.length && /^\|.*\|$/.test(lines[j].trim())) j++;
      blocks.push(lines.slice(i, j).join("\n"));
      i = j;
    } else {
      i++;
    }
  }
  return blocks;
}

// Pulls every pre-computed table out of a message's own tool-call
// results — the verified, ground-truth source these tables came from
// before the model (possibly imperfectly) retyped them into its reply.
export function extractVerifiedTables(message: UIMessage): string[] {
  const tables: string[] = [];
  for (const part of message.parts) {
    if (!isToolUIPart(part) || part.state !== "output-available") continue;
    const output = part.output;
    if (!output || typeof output !== "object") continue;
    for (const field of TABLE_FIELD_NAMES) {
      const value = (output as Record<string, unknown>)[field];
      if (typeof value === "string") tables.push(...extractTableBlocks(value));
    }
  }
  return tables;
}

// The model is instructed to copy a tool's pre-computed table verbatim,
// but a small free model regenerates text token-by-token rather than
// truly copying — confirmed live, more than once, to occasionally
// introduce a hallucinated/garbled character into an otherwise-correct
// cell (e.g. a real accepted-count of 0 retyped as nonsense characters).
// Since the verified original is already sitting in this same message's
// tool-call output, there's no reason to trust the model's own
// reproduction of it at all: find any table in the reply whose header row
// matches a known-good table and swap in the verified version, leaving
// the surrounding prose (lower-stakes if occasionally imperfect) exactly
// as written.
export function substituteVerifiedTables(text: string, verifiedTables: string[]): string {
  if (verifiedTables.length === 0) return text;
  const verifiedByHeader = new Map(verifiedTables.map((t) => [t.split("\n")[0].trim(), t]));

  let result = text;
  for (const block of extractTableBlocks(text)) {
    const header = block.split("\n")[0].trim();
    const verified = verifiedByHeader.get(header);
    if (verified && verified !== block) {
      result = result.replace(block, verified);
    }
  }
  return result;
}

// The system prompt tells the model never to wrap a markdown table in a
// fenced code block (a code block renders as literal preformatted text,
// not a real table) — but this is repeatedly, confirmedly not reliable on
// the free-tier model (seen live more than once). Rather than keep
// re-asking and hoping, detect the shape directly: two lines that look
// like a GFM table header + separator row (e.g. "| Stage | Count |" then
// "|---|---|"), and re-render that content as a real table regardless of
// whether the model actually complied with the instruction.
function looksLikeMarkdownTable(text: string): boolean {
  const lines = text.trim().split("\n");
  return lines.length >= 2 && /^\|.*\|$/.test(lines[0].trim()) && /^\|[\s:-]+\|/.test(lines[1].trim());
}

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
  pre: ({ children, ...props }) => {
    const text = extractText(children);
    if (looksLikeMarkdownTable(text)) {
      return <>{renderMarkdown(text)}</>;
    }
    return <pre {...props}>{children}</pre>;
  },
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
