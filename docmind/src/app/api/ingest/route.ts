import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { embedBatch } from "@/lib/embeddings";
import { chunkText } from "@/lib/chunker";

function getServerSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

interface IngestRequestBody {
  name: string;
  sizeKb: number;
  rawText: string;
}

export async function POST(req: NextRequest) {
  let body: IngestRequestBody;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body." },
      { status: 400 }
    );
  }

  const { name, sizeKb, rawText } = body;

  if (!name || !rawText) {
    return NextResponse.json(
      { error: "name and rawText are required." },
      { status: 400 }
    );
  }

  try {
    const supabase = getServerSupabaseClient();

    // Step 1: Chunk
    const rawChunks = chunkText(rawText);

    // Step 2: Embed — runs server-side, no CORS issue
    const texts = rawChunks.map((c) => c.text);
    const embeddings = await embedBatch(texts);

    // Step 3: Insert document
    const { data: docData, error: docError } = await supabase
      .from("documents")
      .insert({ name, size_kb: sizeKb })
      .select()
      .single();

    if (docError || !docData) {
      throw new Error(`Failed to insert document: ${docError?.message}`);
    }

    // Step 4: Insert chunks
    const chunkRows = rawChunks.map((chunk, i) => ({
      document_id: docData.id,
      chunk_index: chunk.id,
      content: chunk.text,
      embedding: embeddings[i],
    }));

    const { error: chunkError } = await supabase
      .from("chunks")
      .insert(chunkRows);

    if (chunkError) {
      await supabase.from("documents").delete().eq("id", docData.id);
      throw new Error(`Failed to insert chunks: ${chunkError.message}`);
    }

    return NextResponse.json({
      id: docData.id,
      name: docData.name,
      sizeKb,
      chunkCount: rawChunks.length,
      createdAt: docData.created_at,
    });
  } catch (err) {
    console.error("[/api/ingest] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ingestion failed." },
      { status: 500 }
    );
  }
}