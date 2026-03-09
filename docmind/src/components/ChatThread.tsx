"use client";
import { useEffect, useRef, useState } from "react";
import { Message, RetrievedChunk } from "@/lib/types";

interface Props {
  messages: Message[];
  isStreaming: boolean;
}

/**
 * Lightweight markdown renderer — handles the subset we actually use.
 * We don't import a full markdown library to keep the bundle small.
 * For a production app you'd use react-markdown + remark-gfm.
 */
function renderMarkdown(text: string): React.ReactNode[] {
  return text.split("\n").map((line, i) => {
    // Bold
    const parsed = line
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(
        /`(.+?)`/g,
        `<code style="background:rgba(232,184,75,0.12);padding:1px 6px;border-radius:3px;font-family:var(--font-geist-mono);font-size:0.85em">$1</code>`
      );

    if (line.startsWith("## "))
      return (
        <h3 key={i} className="font-semibold text-sm mt-2 mb-1"
          dangerouslySetInnerHTML={{ __html: parsed.slice(3) }} />
      );

    if (line.startsWith("- ") || line.startsWith("• "))
      return (
        <div key={i} className="flex gap-2 my-0.5">
          <span className="text-[#E8B84B] mt-1 shrink-0">▸</span>
          <span dangerouslySetInnerHTML={{ __html: parsed.slice(2) }} />
        </div>
      );

    if (!line.trim()) return <div key={i} className="h-2" />;

    return (
      <p key={i} className="leading-relaxed"
        dangerouslySetInnerHTML={{ __html: parsed }} />
    );
  });
}

// ── Source citation chip + expandable preview ──────────────────────────────

interface SourcesProps {
  sources: RetrievedChunk[];
  messageIndex: number;
}

function Sources({ sources, messageIndex }: SourcesProps) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {sources.map((chunk, i) => (
        <div key={i}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className={`
              inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium
              border transition-all
              ${open === i
                ? "bg-[#E8B84B]/15 border-[#E8B84B]/40 text-[#E8B84B]"
                : "bg-[#E8B84B]/6 border-[#E8B84B]/15 text-[#E8B84B]/70 hover:border-[#E8B84B]/35 hover:text-[#E8B84B]"
              }
            `}
          >
            {/* Grid icon */}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
            </svg>
            chunk {chunk.id + 1}
            <span className="opacity-50">·</span>
            {(chunk.score * 100).toFixed(0)}%
          </button>

          {/* Expanded chunk preview */}
          {open === i && (
            <div className="mt-1.5 p-3 rounded-lg bg-black/30 border border-white/8 text-[11px] text-white/50 font-mono leading-relaxed max-h-32 overflow-y-auto animate-fade-up">
              {chunk.text}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Thinking indicator ─────────────────────────────────────────────────────

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      <div className="thinking-dot" />
      <div className="thinking-dot" />
      <div className="thinking-dot" />
    </div>
  );
}

// ── Avatar ─────────────────────────────────────────────────────────────────

function Avatar({ role }: { role: "user" | "assistant" }) {
  if (role === "user") {
    return (
      <div className="w-7 h-7 rounded-lg bg-white/8 border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      </div>
    );
  }
  return (
    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#E8B84B] to-[#C89A35] flex items-center justify-center shrink-0 mt-0.5">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0B0C0F" strokeWidth="2.5">
        <path d="M9.5 2a2.5 2.5 0 0 1 5 0c.83 0 1.5.67 1.5 1.5S16.33 5 15.5 5h-7C7.67 5 7 4.33 7 3.5S7.67 2 8.5 2"/>
        <path d="M5 5h14v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/>
      </svg>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function ChatThread({ messages, isStreaming }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  /**
   * Auto-scroll to bottom on every new message or streaming token.
   * We use scrollIntoView with "smooth" for a polished feel.
   */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5">
      {messages.map((msg, i) => (
        <div
          key={i}
          className={`animate-fade-up flex gap-3 ${
            msg.role === "user" ? "flex-row-reverse" : "flex-row"
          }`}
        >
          <Avatar role={msg.role} />

          <div className={`flex flex-col max-w-[75%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
            {/* Bubble */}
            <div
              className={`
                px-4 py-3 rounded-2xl text-sm
                ${msg.role === "user"
                  ? "bg-[#E8B84B]/12 border border-[#E8B84B]/20 text-[#F0E6C8] rounded-tr-sm"
                  : "bg-white/[0.04] border border-white/7 text-[#E8E6E0] rounded-tl-sm"
                }
              `}
            >
              {msg.content
                ? renderMarkdown(msg.content)
                : isStreaming && i === messages.length - 1
                ? <ThinkingDots />
                : null
              }
            </div>

            {/* Source citations — only on assistant messages with sources */}
            {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
              <Sources sources={msg.sources} messageIndex={i} />
            )}
          </div>
        </div>
      ))}

      {/* Streaming indicator — shown while waiting for first token */}
      {isStreaming && messages[messages.length - 1]?.content === "" && (
        <div className="flex gap-3 animate-fade-up">
          <Avatar role="assistant" />
          <div className="bg-white/[0.04] border border-white/7 rounded-2xl rounded-tl-sm">
            <ThinkingDots />
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}