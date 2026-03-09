import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";
import { retrieve, formatContext, isRelevant } from "@/lib/retriever";

const groq = new Groq();

const SYSTEM_PROMPT = `You are a precise document analyst. Your job is to answer questions strictly using the provided document context.

Rules:
- Answer ONLY from the provided context. Do not use outside knowledge.
- If the context doesn't contain enough information, say: "The document doesn't cover this topic."
- Be concise and direct. No filler phrases like "Great question!" or "Certainly!".
- When referencing specific information, mention which context section it came from.
- Use markdown formatting for lists, bold terms, and code blocks when it improves clarity.
- Never speculate or infer beyond what the context explicitly states.`;

/**
 * Request body — simplified.
 * We no longer receive pre-retrieved chunks from the client.
 * The server now handles retrieval using the documentId.
 */
interface ChatRequestBody {
  question: string;
  documentId: string;
  history: { role: "user" | "assistant"; content: string }[];
}

export async function POST(req: NextRequest) {
  // ── 1. Parse and validate ────────────────────────────────────────────────
  let body: ChatRequestBody;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body." },
      { status: 400 }
    );
  }

  const { question, documentId, history } = body;

  if (!question?.trim()) {
    return NextResponse.json(
      { error: "Question is required." },
      { status: 400 }
    );
  }

  if (!documentId) {
    return NextResponse.json(
      { error: "documentId is required." },
      { status: 400 }
    );
  }

  // ── 2. Retrieve relevant chunks server-side ──────────────────────────────
  /**
   * Retrieval now happens here, not on the client.
   * The client only sends the question and documentId.
   * This keeps embeddings and Supabase queries server-side.
   */
  let chunks;
  try {
    chunks = await retrieve(question, documentId);
  } catch (err) {
    console.error("[/api/chat] Retrieval error:", err);
    return NextResponse.json(
      { error: "Failed to retrieve context. Please try again." },
      { status: 500 }
    );
  }

  // ── 3. Relevance guard ───────────────────────────────────────────────────
  if (!isRelevant(chunks)) {
    return NextResponse.json(
      {
        error:
          "No relevant content found in the document for this question. Try rephrasing or ask something covered in the document.",
        chunks,         // Return chunks so the client can show source scores
      },
      { status: 200 }
    );
  }

  // ── 4. Build context and messages ───────────────────────────────────────
  const context = formatContext(chunks);

  const messages: Groq.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.slice(-6).map((m) => ({
      role: m.role,
      content: m.content,
    })),
    {
      role: "user" as const,
      content: `DOCUMENT CONTEXT:\n${context}\n\nQUESTION: ${question}`,
    },
  ];

  // ── 5. Stream response ───────────────────────────────────────────────────
  try {
    const stream = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages,
      temperature: 0,
      max_tokens: 1024,
      stream: true,
    });

    const encoder = new TextEncoder();

    /**
     * We prefix the stream with a JSON metadata line containing the chunks.
     * This lets the client show source citations without a separate API call.
     * Format: first line is JSON metadata, rest is the streamed answer.
     */
    const readable = new ReadableStream({
      async start(controller) {
        try {
          // Send chunk metadata first so UI can show sources immediately
          const meta = JSON.stringify({ chunks }) + "\n";
          controller.enqueue(encoder.encode(meta));

          for await (const chunk of stream) {
            const token = chunk.choices[0]?.delta?.content ?? "";
            if (token) {
              controller.enqueue(encoder.encode(token));
            }
          }
        } catch (streamError) {
          controller.error(streamError);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("[/api/chat] Groq error:", error);
    return NextResponse.json(
      { error: "Failed to generate a response. Please try again." },
      { status: 500 }
    );
  }
}