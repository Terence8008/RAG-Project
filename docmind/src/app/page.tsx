"use client";
import { useState, useRef } from "react";
import { DocumentRecord, Message } from "@/lib/types";
import { extractText } from "@/lib/extractor";
import { RetrievedChunk } from "@/lib/types";
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
      const sizeKb = parseFloat((file.size / 1024).toFixed(1));

      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, sizeKb, rawText }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Ingestion failed.");
      }

      const doc = await res.json();

      setDocs((prev) => [
        ...prev,
        {
          id: doc.id,
          name: doc.name,
          sizeKb: doc.sizeKb,
          chunks: [],
          vocab: [],
          createdAt: new Date(doc.createdAt),
        },
      ]);

      setActiveDoc({
        id: doc.id,
        name: doc.name,
        sizeKb: doc.sizeKb,
        chunks: [],
        vocab: [],
        createdAt: new Date(doc.createdAt),
      });

      setMessages([
        {
          role: "assistant",
          content: `**${doc.name}** is ready.\n\n📄 ${rawText.length.toLocaleString()} characters split into **${doc.chunkCount} chunks** and indexed.\n\nAsk me anything about this document.`,
        },
      ]);
    } catch (err) {
      console.error("=== INGESTION ERROR ===", err);
      setMessages([
        {
          role: "assistant",
          content: `${err instanceof Error ? err.message : "Failed to process file."}`,
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  }

  // Chat 
  async function handleSend(question: string) {
    if (!activeDoc || isStreaming) return;

    const userMessage: Message = { role: "user", content: question };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setIsStreaming(true);

    const assistantMessage: Message = {
      role: "assistant",
      content: "",
      sources: [],
    };
    setMessages([...updatedMessages, assistantMessage]);

    try {
      abortRef.current = new AbortController();

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          documentId: activeDoc.id,  // Send ID — server handles retrieval
          history: messages.slice(-6),
        }),
        signal: abortRef.current.signal,
      });

      // Handle JSON error responses
      if (res.headers.get("content-type")?.includes("application/json")) {
        const data = await res.json();
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...assistantMessage,
            content: data.error ?? "Something went wrong.",
            sources: data.chunks ?? [],
          };
          return updated;
        });
        return;
      }

      // Read the stream
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let metaParsed = false;
      let sources: RetrievedChunk[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        accumulated += decoder.decode(value, { stream: true });

        /**
         * First line of the stream is JSON metadata containing sources.
         * We parse it once, then treat everything after as the answer text.
         */
        if (!metaParsed && accumulated.includes("\n")) {
          const newlineIndex = accumulated.indexOf("\n");
          const metaLine = accumulated.slice(0, newlineIndex);
          accumulated = accumulated.slice(newlineIndex + 1);
          metaParsed = true;

          try {
            const meta = JSON.parse(metaLine);
            sources = meta.chunks ?? [];
          } catch {
            // If meta parse fails, treat everything as content
          }
        }

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...assistantMessage,
            content: accumulated,
            sources,
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
          content: " Failed to reach the server. Check your connection.",
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

  // ── Render
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