import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";
import { formatContext, isRelevant } from "@/lib/retriever";
import { RetrievedChunk } from "@/lib/types";

/**
 * Groq client is instantiated once at module level — not inside the handler.
 */
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
 * Request body shape.
 * Typed explicitly so TypeScript catches malformed requests at compile time.
 */
interface ChatRequestBody {
  question: string;
  chunks: RetrievedChunk[];
  history: { role: "user" | "assistant"; content: string }[];
}

/**
 * POST /api/chat
 *
 * Receives a question + pre-retrieved chunks from the client.
 * Builds the prompt, calls Groq, and streams the response back.
 */
export async function POST(req: NextRequest) {
  // ── 1. Parse and validate the request body ──────────────────────────────
  let body: ChatRequestBody;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body." },
      { status: 400 }
    );
  }

  const { question, chunks, history } = body;

  if (!question?.trim()) {
    return NextResponse.json(
      { error: "Question is required." },
      { status: 400 }
    );
  }

  if (!Array.isArray(chunks)) {
    return NextResponse.json(
      { error: "chunks must be an array." },
      { status: 400 }
    );
  }

  //Relevance guard 
  /**
   * If retrieval found nothing relevant, short-circuit here.
   * Don't even call Groq save the API call and give the user
   * a clear message instead of a hallucinated answer.
   */
  if (!isRelevant(chunks)) {
    return NextResponse.json(
      {
        error:
          "No relevant content found in the document for this question. Try rephrasing or ask something covered in the document.",
      },
      { status: 200 } // 200 because this is an expected app state, not a server error
    );
  }

  //  Build the context block 
  const context = formatContext(chunks);

  //Build the message history 
  /**
   * We include the last 6 messages (3 turns) of history for conversational
   * context. Including everything would bloat the prompt unnecessarily.
   */
  const messages: Groq.Chat.ChatCompletionMessageParam[] = [
    // System prompt goes first, inside messages — not as a separate parameter
    {
        role: "system",
        content: SYSTEM_PROMPT,
    },
    // Previous conversation turns (capped at last 6)
    ...history.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
    })),
    // Current question with fresh context injected
    {
        role: "user" as const,
        content: `DOCUMENT CONTEXT:\n${context}\n\nQUESTION: ${question}`,
    },
    ];

    // Call Groq with streaming 
    try {
    const stream = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages,
        temperature: 0,
        max_tokens: 1024,
        stream: true,
    });

    //Stream the response back to the client 
    /**
     * TransformStream bridges Groq's async iterator to the Web Streams API
     * that Next.js Response expects.
     */
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
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
        // Tells the browser this is a stream — don't buffer, render immediately
        "X-Content-Type-Options": "nosniff",
        // Prevents Vercel/CDN from caching streamed responses
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    // Groq API errors — rate limit, invalid key, model unavailable, etc.
    console.error("[/api/chat] Groq error:", error);

    return NextResponse.json(
      { error: "Failed to generate a response. Please try again." },
      { status: 500 }
    );
  }
}