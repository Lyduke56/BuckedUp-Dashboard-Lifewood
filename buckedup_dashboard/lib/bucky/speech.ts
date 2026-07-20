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
interface SpeechRecognitionErrorEventLike extends Event {
  error?: string;
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
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

// Maps the Web Speech API's error codes to a message a non-technical user
// can act on. "network" is the big one: Chromium's speech-to-text streams
// audio to Google's servers, and some Chromium browsers (notably Brave)
// ship the API surface but deliberately strip that backend for privacy —
// so the mic button renders (feature detection passes) yet recognition
// always dies with "network". Confirmed live in Brave: mic lights up,
// nothing ever lands in the box. Without surfacing this, the failure is
// completely silent.
function describeRecognitionError(code: string | undefined): string | null {
  switch (code) {
    case "aborted": // user stopped it themselves — not an error worth showing
      return null;
    case "no-speech":
      return "Didn't catch anything — try speaking again.";
    case "audio-capture":
      return "No microphone was found — check that one is connected.";
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access is blocked — allow it for this site in your browser settings.";
    case "network":
      return "Your browser couldn't reach its speech service — some browsers (like Brave) block voice input entirely. Try Chrome or Edge.";
    default:
      return "Voice input failed — try again, or type instead.";
  }
}

// Returns null when unsupported rather than throwing — callers should
// hide the mic control entirely in that case (see isSpeechRecognitionSupported).
// onError receives a user-facing message (or fires not at all for benign
// cases like the user aborting); onEnd always fires when listening stops,
// error or not, so callers can reset their "listening" state in one place.
export function createRecognizer(
  onResult: (text: string) => void,
  onEnd: () => void,
  onError?: (message: string) => void,
): SpeechRecognitionLike | null {
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
  // The browser fires onend after onerror anyway, so onend alone is enough
  // to reset listening state — onerror only adds the explanation.
  recognizer.onend = onEnd;
  recognizer.onerror = (event) => {
    const message = describeRecognitionError(event.error);
    if (message && onError) onError(message);
  };
  return recognizer;
}
