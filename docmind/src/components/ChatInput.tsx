"use client";
import { useState, useRef, KeyboardEvent } from "react";

interface Props {
  onSend: (question: string) => void;
  isStreaming: boolean;
  disabled: boolean;
  docName: string;
}

/**
 * Suggested questions shown after a document is loaded.
 * These help users understand what the system can do
 * and make the demo more impressive during portfolio walkthroughs.
 */
const SUGGESTIONS = [
  "Summarize this document",
  "What are the key points?",
  "List any dates or numbers",
  "What is the main topic?",
];

export default function ChatInput({ onSend, isStreaming, disabled, docName }: Props) {
  const [value, setValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || isStreaming || disabled) return;
    onSend(trimmed);
    setValue("");
    setShowSuggestions(false);
    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  /**
   * Submit on Enter, newline on Shift+Enter.
   * Standard chat UX pattern — users expect this.
   */
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  /**
   * Auto-grow textarea — expands as the user types, capped at 5 rows.
   * Better UX than a fixed single-line input for longer questions.
   */
  function onInput() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  function handleSuggestion(suggestion: string) {
    onSend(suggestion);
    setShowSuggestions(false);
  }

  return (
    <div className="shrink-0 px-6 pb-6 pt-3 border-t border-white/5">

      {/* Suggestion chips — shown only on first interaction */}
      {showSuggestions && (
        <div className="flex flex-wrap gap-2 mb-3">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => handleSuggestion(s)}
              disabled={isStreaming}
              className="px-3 py-1.5 text-xs rounded-full border border-white/8 text-white/40 hover:border-[#E8B84B]/30 hover:text-white/70 transition-all disabled:opacity-30"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input row */}
      <div
        className={`
          flex items-end gap-3 px-4 py-3 rounded-xl border transition-colors
          bg-white/[0.03]
          ${isStreaming || disabled
            ? "border-white/5"
            : "border-white/8 focus-within:border-[#E8B84B]/35"
          }
        `}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          onInput={onInput}
          disabled={isStreaming || disabled}
          placeholder={`Ask anything about ${docName}…`}
          rows={1}
          className="flex-1 bg-transparent resize-none text-sm text-white/90 placeholder:text-white/25 outline-none leading-relaxed disabled:opacity-40"
          style={{ maxHeight: 120 }}
        />

        {/* Send button */}
        <button
          onClick={submit}
          disabled={!value.trim() || isStreaming || disabled}
          className="shrink-0 w-8 h-8 rounded-lg bg-[#E8B84B] flex items-center justify-center transition-all hover:bg-[#F0C866] disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {isStreaming ? (
            <div className="spinner" style={{ width: 12, height: 12, borderColor: "rgba(0,0,0,0.2)", borderTopColor: "#0B0C0F" }} />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0B0C0F" strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          )}
        </button>
      </div>

      {/* Footer note */}
      <p className="text-center text-[10px] text-white/15 mt-2.5 tracking-wide">
        Powered by Groq · Llama 3.3 70B · TF-IDF retrieval · {" "}
        <span className="text-[#E8B84B]/30">Enter to send</span>
      </p>
    </div>
  );
}