import { Chunk } from "./types";

/**
 * Splits raw text into overlapping chunks.
 */
export function chunkText(
  text: string,
  chunkSize: number = 800,
  overlap: number = 150
): Omit<Chunk, "vector">[] {
  // Normalize whitespace — multiple spaces, tabs, and newlines become single spaces.
  const normalized = text.replace(/\s+/g, " ").trim();

  const chunks: Omit<Chunk, "vector">[] = [];
  let i = 0;

  while (i < normalized.length) {
    const text = normalized.slice(i, i + chunkSize);

    if (text.length < 50 && chunks.length > 0) break;

    chunks.push({ id: chunks.length, text });

    i += chunkSize - overlap;
  }

  return chunks;
}

/**
 * Extracts plain text from different file types.
 */
export async function extractText(file: File): Promise<string> {
  const type = file.type;

  // Plain text, markdown, CSV, JSON just read as text
  if (
    type === "text/plain" ||
    type === "text/markdown" ||
    type === "text/csv" ||
    type === "application/json"
  ) {
    return await file.text();
  }

  // For production probably need to use a proper PDF parser (pdf-parse, pdfjs-dist).
  if (type === "application/pdf") {
    return await extractPdfText(file);
  }

  throw new Error(`Unsupported file type: ${type}. Upload .txt, .md, .pdf, .csv, or .json`);
}

async function extractPdfText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const raw = new TextDecoder("latin1").decode(bytes);

  // Extract text between BT (Begin Text) and ET (End Text) PDF operators
  const textBlocks = raw.match(/BT[\s\S]*?ET/g) || [];

  const extracted = textBlocks
    .join(" ")
    // Tj and TJ are the PDF "show text" operators
    .replace(/\(([^)]+)\)\s*Tj/g, "$1 ")
    .replace(/\(([^)]+)\)\s*TJ/g, "$1 ")
    // Strip non-printable characters
    .replace(/[^\x20-\x7E\n]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (extracted.length < 100) {
    throw new Error(
      "Could not extract text from this PDF. It may be scanned or image-based. Try a text-based PDF."
    );
  }

  return extracted;
}