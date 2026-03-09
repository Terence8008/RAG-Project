"use client";
import { useState, useRef } from "react";
import { DocumentRecord, Message } from "@/lib/types";
import { createDocument } from "@/lib/vectorStore";
import { extractText } from "@/lib/chunker";
import { retrieve } from "@/lib/retriever";
import UploadZone from "@/components/UploadZone";
import Sidebar from "@/components/Sidebar";
import ChatThread from "@/components/ChatThread";
import ChatInput from "@/components/ChatInput";

export default function Home() {
  // ── State ──────────────────────────────────────────────────────────────
  /**
   * All documents loaded in this session.
   * In production this would be persisted to a DB or vector store.
   * Here it's intentionally ephemeral — refresh clears everything.
   */
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [activeDoc, setActiveDoc] = useState<DocumentRecord | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false); // file processing
  const [isStreaming, setIsStreaming] = useState(false);   // waiting for Groq

  const abortRef = useRef<AbortController | null>(null);

  // ── File ingestion ─────────────────────────────────────────────────────
  /**
   * Full pipeline: File → extracted text → chunked → vectorized → stored.
   * All of this runs in the browser. Nothing is sent to the server yet.
   */
  async function handleFileUpload(file: File) {
    setIsProcessing(true);
    try {
      const rawText = await extractText(file);
      const doc = createDocument(
        crypto.randomUUID(),
        file.name,
        parseFloat((file.size / 1024).toFixed(1)),
        rawText
      );
      setDocs((prev) => [...prev, doc]);
      setActiveDoc(doc);
      setMessages([
        {
          role: "assistant",
          content: `**${file.name}** is ready.\n\n📄 ${rawText.length.toLocaleString()} characters split into **${doc.chunks.length} chunks** and indexed.\n\nAsk me anything about this document.`,
        },
      ]);
    } catch (err) {
      setMessages([
        {
          role: "assistant",
          content: `⚠️ ${err instanceof Error ? err.message : "Failed to process file."}`,
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  }

  // ── Chat ───────────────────────────────────────────────────────────────
  async function handleSend(question: string) {
    if (!activeDoc || isStreaming) return;

    // Append user message immediately for responsive feel
    const userMessage: Message = { role: "user", content: question };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setIsStreaming(true);

    // Retrieve relevant chunks client-side
    const chunks = retrieve(question, activeDoc);

    // Placeholder assistant message — we'll stream into this
    const assistantMessage: Message = {
      role: "assistant",
      content: "",
      sources: chunks,
    };
    setMessages([...updatedMessages, assistantMessage]);

    try {
      abortRef.current = new AbortController();

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          chunks,
          history: messages.slice(-6),
        }),
        signal: abortRef.current.signal,
      });

      // Handle non-streaming error responses (validation, relevance guard)
      if (!res.ok || res.headers.get("content-type")?.includes("application/json")) {
        const data = await res.json();
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...assistantMessage,
            content: data.error ?? "Something went wrong.",
          };
          return updated;
        });
        return;
      }

      /**
       * Stream reading — we read the response body chunk by chunk
       * and append each token to the last message in state.
       *
       * This is why the assistant message starts with content: "" —
       * we mutate it in place as tokens arrive.
       */
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        accumulated += decoder.decode(value, { stream: true });

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...assistantMessage,
            content: accumulated,
          };
          return updated;
        });
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...assistantMessage,
          content: "⚠️ Failed to reach the server. Check your connection.",
        };
        return updated;
      });
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }

  function handleSwitchDoc(doc: DocumentRecord) {
    setActiveDoc(doc);
    setMessages([
      {
        role: "assistant",
        content: `Switched to **${doc.name}**. ${doc.chunks.length} chunks loaded. What would you like to know?`,
      },
    ]);
  }

  function handleRemoveDoc(id: string) {
    setDocs((prev) => prev.filter((d) => d.id !== id));
    if (activeDoc?.id === id) {
      setActiveDoc(null);
      setMessages([]);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar — document list */}
      <Sidebar
        docs={docs}
        activeDoc={activeDoc}
        isProcessing={isProcessing}
        onUpload={handleFileUpload}
        onSwitch={handleSwitchDoc}
        onRemove={handleRemoveDoc}
      />

      {/* Main panel */}
      <main className="flex flex-col flex-1 overflow-hidden">
        {!activeDoc ? (
          // Empty state — shown before any document is loaded
          <div className="flex flex-1 items-center justify-center p-8">
            <UploadZone onUpload={handleFileUpload} isProcessing={isProcessing} />
          </div>
        ) : (
          <>
            {/* Header bar */}
            <header className="flex items-center justify-between px-6 py-3 border-b border-white/5 shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-[#E8B84B] text-sm font-medium truncate max-w-[300px]">
                  {activeDoc.name}
                </span>
                <span className="text-white/25 text-xs">·</span>
                <span className="text-white/30 text-xs">
                  {activeDoc.chunks.length} chunks indexed
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-white/30 text-xs">Ready</span>
              </div>
            </header>

            {/* Chat thread */}
            <ChatThread messages={messages} isStreaming={isStreaming} />

            {/* Input */}
            <ChatInput
              onSend={handleSend}
              isStreaming={isStreaming}
              disabled={!activeDoc}
              docName={activeDoc.name}
            />
          </>
        )}
      </main>
    </div>
  );
}