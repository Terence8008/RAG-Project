/**
 * This module runs SERVER-SIDE ONLY.
 * It handles embedding the query and searching Supabase.
 * Previous architecture: client retrieves → sends chunks to server
 * New architecture:      client sends question → server retrieves + generates
 */

import { createClient } from "@supabase/supabase-js";
import { embedQuery } from "./embeddings";
import { SupabaseChunkMatch, RetrievedChunk } from "./types";

/**
 * Server-side Supabase client.
 * Uses the service role key for elevated permissions if needed,
 * or anon key if RLS is disabled (portfolio setup).
 */
function getServerSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase environment variables are not set on the server."
    );
  }

  return createClient(url, key);
}

/**
 * Retrieves the most semantically relevant chunks for a query.
 *
 * Pipeline:
 * 1. Embed the query using the same model used at indexing time
 * 2. Call the match_chunks Postgres function via Supabase RPC
 * 3. Return ranked results with similarity scores
 *
 * Why RPC instead of a raw Supabase query?
 * The pgvector similarity search requires a custom SQL function.
 * Supabase's JS client can't express "<=> operator" queries directly,
 * but it can call Postgres functions via .rpc() — clean and type-safe.
 */
export async function retrieve(
    query: string,
    documentId: string,
    topK: number = 4,
    threshold: number = 0.1
  ): Promise<RetrievedChunk[]> {
    const queryEmbedding = await embedQuery(query);

    console.log("Query embedding length:", queryEmbedding.length);
    console.log("Document ID being searched:", documentId);
    console.log("Threshold:", threshold);

    const supabase = getServerSupabaseClient();

    const { data, error } = await supabase.rpc("match_chunks", {
      query_embedding: queryEmbedding,
      match_document_id: documentId,
      match_count: topK,
      match_threshold: threshold,
    });

    console.log("RPC error:", error);
    console.log("RPC data:", data);

    if (error) {
      throw new Error(`Retrieval failed: ${error.message}`);
    }

    return (data ?? []).map((match: SupabaseChunkMatch) => ({
      id: match.chunk_index,
      text: match.content,
      vector: [],
      score: match.similarity,
    }));
  }

/**
 * Formats retrieved chunks into a labeled context block for the LLM.
 * Unchanged from before — the output shape is the same regardless of
 * whether retrieval was TF-IDF or vector-based.
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
 * Relevance guard — unchanged logic, different threshold.
 * 0.3 is appropriate for cosine similarity with MiniLM embeddings.
 * TF-IDF used 0.05 because its scores are much lower by nature.
 */
export function isRelevant(chunks: RetrievedChunk[]): boolean {
  if (chunks.length === 0) return false;
  return chunks[0].score >= 0.3;
}