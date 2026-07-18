// Browser-native voice for Bucky — the Web Speech API needs no provider
// account, key, or server-side code (unlike the `ai` package's
// generateSpeech/transcribe primitives, which OpenRouter doesn't implement
// anyway), so this runs entirely client-side for free. Kept as its own
// module rather than inlined into BuckyWidget.tsx (already a large file)
// since it's a self-contained, framework-free concern.
//
// Real, disclosed limitation: SpeechRecognition (voice input) support is
// inconsistent across browsers — solid in Chrome/Edge, absent in Firefox,
// limited in Safari. speechSynthesis (spoken replies) has much broader
// support. Every function here feature-detects and degrades gracefully
// rather than throwing when the API isn't available.

// Not in TypeScript's default lib.dom.d.ts (or only partially, depending
// on lib version) — declared narrowly here, just the surface this module
// actually uses, rather than pulling in a full third-party type package
// for a browser API with no complex shape.
interface SpeechRecognitionResultLike {
  transcript: string;
}
interface SpeechRecognitionEventLike extends Event {
  results: { [index: number]: { [index: number]: SpeechRecognitionResultLike; isFinal: boolean }; length: number };
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: Event) => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getRecognitionConstructor() !== null;
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

// Strips the markdown syntax renderMarkdown() renders for real, so
// headings/table pipes/asterisks aren't read aloud as literal symbols.
// Deliberately simple (not a full markdown parser) — good enough for
// natural-sounding speech, not for a byte-perfect plain-text conversion.
function stripMarkdownForSpeech(text: string): string {
  return text
    .replace(/\|/g, ", ")
    .replace(/[#*_`>]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .trim();
}

export function speak(text: string): void {
  if (!isSpeechSynthesisSupported()) return;
  window.speechSynthesis.cancel(); // never overlap two utterances
  const utterance = new SpeechSynthesisUtterance(stripMarkdownForSpeech(text));
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (!isSpeechSynthesisSupported()) return;
  window.speechSynthesis.cancel();
}

// Returns null when unsupported rather than throwing — callers should
// hide the mic control entirely in that case (see isSpeechRecognitionSupported).
export function createRecognizer(onResult: (text: string) => void, onEnd: () => void): SpeechRecognitionLike | null {
  const Ctor = getRecognitionConstructor();
  if (!Ctor) return null;
  const recognizer = new Ctor();
  recognizer.lang = "en-US";
  recognizer.interimResults = false;
  recognizer.continuous = false;
  recognizer.onresult = (event) => {
    const last = event.results[event.results.length - 1];
    const transcript = last?.[0]?.transcript;
    if (transcript) onResult(transcript);
  };
  recognizer.onend = onEnd;
  recognizer.onerror = onEnd;
  return recognizer;
}
