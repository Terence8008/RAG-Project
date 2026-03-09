/**
 * A single chunk of text extracted from a document.
 * We store both the raw text and its TF-IDF vector representation.
 */
export interface Chunk {
  id: number;
  text: string;
  vector: number[]; // TF-IDF vector, populated after vocab is built
}

/**
 * A processed document stored in memory.
 * In a production system, this would live in a vector DB .
 */
export interface DocumentRecord {
  id: string;
  name: string;
  sizeKb: number;
  chunks: Chunk[];
  vocab: string[]; // Legacy — no longer used with embedding-based retrieval
  createdAt: Date;
}

/**
 * A single message in the chat thread.
 */
export interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: RetrievedChunk[]; // only present on assistant messages
}

/**
 * A chunk returned by the retriever, with its relevance score attached.
 */
export interface RetrievedChunk extends Chunk {
  score: number; // cosine similarity, 0–1
}

// returned by the Supabase match_chunks RPC
export interface SupabaseChunkMatch {
  id: number;
  document_id: string;
  chunk_index: number;
  content: string;
  similarity: number;
}