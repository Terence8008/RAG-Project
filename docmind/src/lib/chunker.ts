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