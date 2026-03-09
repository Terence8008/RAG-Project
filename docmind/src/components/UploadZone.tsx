import { useRef, useState, DragEvent, ChangeEvent } from "react";

interface Props {
  onUpload: (file: File) => void;
  isProcessing: boolean;
}

const ACCEPTED = [".txt", ".md", ".pdf", ".csv", ".json"];
const ACCEPTED_MIME = [
  "text/plain",
  "text/markdown",
  "application/pdf",
  "text/csv",
  "application/json",
];

export default function UploadZone({ onUpload, isProcessing }: Props) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function validate(file: File): string | null {
    if (!ACCEPTED_MIME.includes(file.type)) {
      return `Unsupported file type. Upload ${ACCEPTED.join(", ")}`;
    }
    // 10MB limit — generous for a text document, prevents huge PDFs
    if (file.size > 10 * 1024 * 1024) {
      return "File too large. Maximum size is 10MB.";
    }
    return null;
  }

  function handleFile(file: File) {
    const err = validate(file);
    if (err) { setError(err); return; }
    setError(null);
    onUpload(file);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input so same file can be re-uploaded
    e.target.value = "";
  }

  return (
    <div className="w-full max-w-lg">
      <div
        onClick={() => !isProcessing && inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        className={`
          relative flex flex-col items-center justify-center gap-5
          border-2 border-dashed rounded-2xl p-16 cursor-pointer
          transition-all duration-200
          ${isDragOver
            ? "border-[#E8B84B]/70 bg-[#E8B84B]/5"
            : "border-white/10 hover:border-[#E8B84B]/30 hover:bg-white/[0.02]"
          }
          ${isProcessing ? "pointer-events-none opacity-60" : ""}
        `}
      >
        {/* Icon */}
        <div className="w-14 h-14 rounded-xl bg-[#E8B84B]/10 border border-[#E8B84B]/20 flex items-center justify-center">
          {isProcessing ? (
            <div className="spinner" />
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E8B84B" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/>
              <line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
          )}
        </div>

        {/* Text */}
        <div className="text-center">
          <p className="text-[#E8E6E0] font-medium mb-1">
            {isProcessing ? "Processing document…" : "Drop your document here"}
          </p>
          <p className="text-white/35 text-sm">
            {isProcessing
              ? "Chunking and indexing, this will only take a moment"
              : `Supports ${ACCEPTED.join(" · ")}`
            }
          </p>
        </div>

        {!isProcessing && (
          <button className="px-5 py-2 text-sm border border-white/10 rounded-lg text-white/60 hover:border-[#E8B84B]/40 hover:text-white/90 transition-all">
            Browse files
          </button>
        )}
      </div>

      {/* Validation error */}
      {error && (
        <p className="mt-3 text-center text-sm text-red-400/80">{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        onChange={onChange}
        className="hidden"
      />
    </div>
  );
}