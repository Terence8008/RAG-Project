import { Chunk, DocumentRecord } from "./types";
import { chunkText } from "./chunker";

/**
 * Builds a vocabulary from a set of chunks.
 *
 * The vocabulary is every unique word across all chunks.
 * This becomes the dimensions of our vector space.
 * More words = higher dimensional vectors = more precise similarity.
 *
 * In production: you'd use a pre-trained embedding model (e.g. text-embedding-3-small)
 * to generate dense 1536-dimension vectors. Our TF-IDF approach generates sparse
 * vectors but requires zero API calls and is fully explainable.
 */
function buildVocab(chunks: Omit<Chunk, "vector">[]): string[] {
  const wordSet = new Set<string>();

  chunks.forEach((chunk) => {
    const words = tokenize(chunk.text);
    words.forEach((w) => wordSet.add(w));
  });

  return Array.from(wordSet);
}

/**
 * Converts text to a TF-IDF weighted vector.
 *
 * TF  (Term Frequency)  = how often a word appears in THIS chunk
 * IDF (Inverse Doc Freq) = how rare the word is across ALL chunks
 *
 * TF-IDF is high for words that are frequent in a chunk but rare overall.
 * This means common words like "the", "is", "and" get low scores,
 * while specific words like "photosynthesis" or "plaintiff" score high.
 */
function vectorize(
  text: string,
  vocab: string[],
  allChunks: Omit<Chunk, "vector">[]
): number[] {
  const words = tokenize(text);
  const wordCount = words.length || 1;

  // Term frequency map for this chunk
  const tf: Record<string, number> = {};
  words.forEach((w) => { tf[w] = (tf[w] || 0) + 1; });

  return vocab.map((term) => {
    // TF: normalized frequency of this term in this chunk
    const termFreq = (tf[term] || 0) / wordCount;
    if (termFreq === 0) return 0;

    // IDF: log of (total chunks / chunks containing this term)
    const docsWithTerm = allChunks.filter((c) =>
      tokenize(c.text).includes(term)
    ).length;
    const idf = Math.log(allChunks.length / (docsWithTerm + 1));

    return termFreq * idf;
  });
}

/**
 * Tokenizer — lowercase, alphanumeric words only, stop words removed.
 * Stop words don't carry meaning and add noise to similarity scores.
 */
function tokenize(text: string): string[] {
  const stopWords = new Set([
    "the", "is", "at", "which", "on", "a", "an", "and", "or", "but",
    "in", "with", "to", "of", "for", "as", "by", "from", "it", "its",
    "this", "that", "was", "are", "be", "been", "has", "have", "had",
    "do", "does", "did", "will", "would", "could", "should", "may",
    "not", "no", "so", "if", "then", "than", "also", "into", "about",
  ]);

  return (text.toLowerCase().match(/\b[a-z]\w+\b/g) || []).filter(
    (w) => !stopWords.has(w) && w.length > 2
  );
}

/**
 * Processes a raw file into a fully indexed DocumentRecord.
 *
 * This is the only public function in this module — a clean interface
 * that hides all the vectorization complexity from the rest of the app.
 */
export function createDocument(
  id: string,
  name: string,
  sizeKb: number,
  rawText: string
): DocumentRecord {
  // Split into chunks
  const rawChunks = chunkText(rawText);

  // Build vocabulary from all chunks
  const vocab = buildVocab(rawChunks);

  // Vectorize every chunk using TF-IDF
  const chunks: Chunk[] = rawChunks.map((chunk) => ({
    ...chunk,
    vector: vectorize(chunk.text, vocab, rawChunks),
  }));

  return {
    id,
    name,
    sizeKb,
    chunks,
    vocab,
    createdAt: new Date(),
  };
}