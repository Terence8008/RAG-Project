"use client";

import { Chunk } from "./types";

export function chunkText(
  text: string,
  chunkSize: number = 800,
  overlap: number = 150
): Omit<Chunk, "vector">[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  const chunks: Omit<Chunk, "vector">[] = [];
  let i = 0;

  while (i < normalized.length) {
    const sliced = normalized.slice(i, i + chunkSize);
    if (sliced.length < 50 && chunks.length > 0) break;
    chunks.push({ id: chunks.length, text: sliced });
    i += chunkSize - overlap;
  }

  return chunks;
}

export async function extractText(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (["txt", "md", "csv", "json"].includes(ext ?? "")) {
    return await file.text();
  }

  if (ext === "pdf") {
    return await extractPdfText(file);
  }

  throw new Error(
    `Unsupported file type. Upload .txt, .md, .pdf, .csv, or .json`
  );
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
  }).promise;

  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    const rawText = content.items
      .filter((item) => "str" in item)
      .map((item) => (item as { str: string }).str)
      .join("");

    pageTexts.push(rawText);
  }

  let fullText = pageTexts.join(" ");

  /**
   * Fix character-spread encoding at the string level.
   *
   */
  fullText = fullText.replace(
    /\b([A-Za-z] ){4,}[A-Za-z]\b/g,
    (match) => match.replace(/ /g, "")
  );

  /**
   * After collapsing char-spreads, add spaces between
   * concatenated words using camelCase-style boundary detection.
   */
  fullText = fullText
    .replace(/([a-z])([A-Z])/g, "$1 $2")  // camelCase → camel Case
    .replace(/\s+/g, " ")
    .trim();

  if (fullText.length < 50) {
    throw new Error(
      "Could not extract text from this PDF. It may be scanned or image-based."
    );
  }

  return fullText;
}