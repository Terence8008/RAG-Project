"use client";
import { useRef } from "react";
import { DocumentRecord } from "@/lib/types";

interface Props {
  docs: DocumentRecord[];
  activeDoc: DocumentRecord | null;
  isProcessing: boolean;
  onUpload: (file: File) => void;
  onSwitch: (doc: DocumentRecord) => void;
  onRemove: (id: string) => void;
}

export default function Sidebar({
  docs, activeDoc, isProcessing, onUpload, onSwitch, onRemove,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
    e.target.value = "";
  }

  return (
    <aside className="w-56 shrink-0 flex flex-col border-r border-white/5 bg-white/[0.01]">
      {/* Brand */}
      <div className="px-4 py-4 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#E8B84B] to-[#C89A35] flex items-center justify-center shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0B0C0F" strokeWidth="2.5">
              <path d="M9.5 2a2.5 2.5 0 0 1 5 0c.83 0 1.5.67 1.5 1.5S16.33 5 15.5 5h-7C7.67 5 7 4.33 7 3.5S7.67 2 8.5 2"/>
              <path d="M5 5h14v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold leading-none tracking-tight">DocMind</p>
            <p className="text-[10px] text-white/30 mt-0.5 tracking-widest uppercase">RAG</p>
          </div>
        </div>
      </div>

      {/* Upload button */}
      <div className="px-3 pt-3">
        <button
          onClick={() => inputRef.current?.click()}
          disabled={isProcessing}
          className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-lg border border-[#E8B84B]/25 text-[#E8B84B] hover:bg-[#E8B84B]/8 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <><div className="spinner" /> Processing…</>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add Document
            </>
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".txt,.md,.pdf,.csv,.json"
          onChange={onChange}
          className="hidden"
        />
      </div>

      {/* Document list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-1">
        <p className="text-[10px] text-white/20 uppercase tracking-widest px-1 mb-1">
          Documents ({docs.length})
        </p>

        {docs.length === 0 ? (
          <p className="text-xs text-white/20 text-center mt-6 leading-relaxed px-2">
            No documents loaded.<br />Upload one to get started.
          </p>
        ) : (
          docs.map((doc) => (
            <div
              key={doc.id}
              onClick={() => onSwitch(doc)}
              className={`
                group flex items-start gap-2 px-2.5 py-2.5 rounded-lg cursor-pointer transition-all
                ${activeDoc?.id === doc.id
                  ? "bg-[#E8B84B]/10 border border-[#E8B84B]/25"
                  : "hover:bg-white/[0.04] border border-transparent"
                }
              `}
            >
              {/* File icon */}
              <svg className="shrink-0 mt-0.5 text-[#E8B84B]/70" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>

              {/* Name + meta */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate leading-tight">{doc.name}</p>
                <p className="text-[10px] text-white/30 mt-0.5">{doc.sizeKb} KB · {doc.chunks.length} chunks</p>
              </div>

              {/* Remove button */}
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(doc.id); }}
                className="opacity-0 group-hover:opacity-100 text-white/25 hover:text-red-400 transition-all shrink-0"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          ))
        )}
      </div>

      {/* Architecture note — great for portfolio walkthroughs */}
      <div className="px-3 pb-4">
        <div className="rounded-lg bg-white/[0.03] border border-white/5 p-3">
          <p className="text-[10px] text-white/25 leading-relaxed">
            <span className="text-[#E8B84B]/60 font-medium block mb-1">Pipeline</span>
            Extract → Chunk → Vectorize → Retrieve → Generate
          </p>
        </div>
      </div>
    </aside>
  );
}