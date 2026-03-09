
/**
 * Generates embeddings using Hugging Face Inference API.
 * Model: sentence-transformers/all-MiniLM-L6-v2
 *
 */

const HF_MODEL = "sentence-transformers/all-MiniLM-L6-v2";
const HF_API_URL = `https://router.huggingface.co/hf-inference/models/${HF_MODEL}/pipeline/feature-extraction`;

/**
 * Embeds a single string — used for query embedding at retrieval time.
 */
export async function embedQuery(text: string): Promise<number[]> {
  const result = await embedBatch([text]);
  return result[0];
}

/**
 * Embeds multiple strings in one API call — used during document indexing.
 *
 * HF Inference API has a limit of ~100 inputs per batch.
 * chunk the batch into groups of 50 to stay safe.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.HF_API_KEY ?? process.env.NEXT_PUBLIC_HF_API_KEY;

  if (!apiKey) {
    throw new Error("HF_API_KEY is not set in environment variables.");
  }

  // Split into batches of 50
  const batches: string[][] = [];
  for (let i = 0; i < texts.length; i += 50) {
    batches.push(texts.slice(i, i + 50));
  }

  const allEmbeddings: number[][] = [];

  for (const batch of batches) {
    const res = await fetch(HF_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: batch,
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Hugging Face API error: ${res.status} — ${error}`);
    }

    const data = await res.json();

    /**
     * HF returns either:
     * - number[][] when inputs is an array (what we want)
     * - number[] when inputs is a single string
     *
     * We always send an array so we always get number[][] back.
     */
    if (!Array.isArray(data) || !Array.isArray(data[0])) {
      throw new Error(`Unexpected embedding response shape: ${JSON.stringify(data).slice(0, 200)}`);
    }

    allEmbeddings.push(...(data as number[][]));
  }

  return allEmbeddings;
}