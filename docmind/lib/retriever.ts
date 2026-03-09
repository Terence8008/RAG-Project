import { Chunk, DocumentRecord, RetrievedChunk } from "./types";

/**
 * Cosine similarity between two vectors.
 * Returns a value between -1 and 1. In practice with TF-IDF (no negatives)
 * it's always 0–1. 1 = identical direction, 0 = completely unrelated.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] ** 2;
    normB += b[i] ** 2;
  }

  // Guard against division by zero (zero vectors = empty/stopword-only chunks)
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dot / denominator;
}

/**
 * Vectorizes the user's query using the same vocab and TF-IDF logic
 * that was used to index the document.
 */
function vectorizeQuery(query: string, vocab: string[]): number[] {
  const stopWords = new Set([
    "the", "is", "at", "which", "on", "a", "an", "and", "or", "but",
    "in", "with", "to", "of", "for", "as", "by", "from", "it", "its",
    "this", "that", "was", "are", "be", "been", "has", "have", "had",
    "do", "does", "did", "will", "would", "could", "should", "may",
    "not", "no", "so", "if", "then", "than", "also", "into", "about",
  ]);

  const words = (query.toLowerCase().match(/\b[a-z]\w+\b/g) || []).filter(
    (w) => !stopWords.has(w) && w.length > 2
  );

  const wordCount = words.length || 1;

  // TF only for the query — no IDF needed here because the query is a
  // single "document". We just want term frequency relative to its length.
  const tf: Record<string, number> = {};
  words.forEach((w) => { tf[w] = (tf[w] || 0) + 1; });

  return vocab.map((term) => (tf[term] || 0) / wordCount);
}

/**
 * Retrieves the top-K most relevant chunks for a given query.
 *
 * This is the core retrieval step of RAG:
 * 1. Vectorize the query in the document's vocab space
 * 2. Score every chunk via cosine similarity
 * 3. Sort descending and take the top K
 * 4. Filter out chunks with near-zero scores (irrelevant noise)
 *
 * @param query     - The user's question
 * @param document  - The indexed DocumentRecord to search
 * @param topK      - How many chunks to return (default 4)
 * @param threshold - Minimum score to include a chunk (default 0.01)
 */
export function retrieve(
  query: string,
  document: DocumentRecord,
  topK: number = 4,
  threshold: number = 0.01
): RetrievedChunk[] {
  const queryVector = vectorizeQuery(query, document.vocab);

  const scored: RetrievedChunk[] = document.chunks.map((chunk) => ({
    ...chunk,
    score: cosineSimilarity(queryVector, chunk.vector),
  }));

  return scored
    .filter((chunk) => chunk.score > threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/**
 * Formats retrieved chunks into a context block for the LLM prompt. So the model can reference them specifically.
 */
export function formatContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return "No relevant context found in the document for this query.";
  }

  return chunks
    .map(
      (chunk, i) =>
        `[Context ${i + 1} | relevance: ${(chunk.score * 100).toFixed(1)}%]\n${chunk.text}`
    )
    .join("\n\n---\n\n");
}

/**
 * Decides whether the retrieved chunks are relevant enough to answer.
 */
export function isRelevant(chunks: RetrievedChunk[]): boolean {
  if (chunks.length === 0) return false;
  return chunks[0].score >= 0.05;
}