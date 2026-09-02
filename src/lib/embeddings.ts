/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Embedding Pipeline — Real Vector Generation
 * ═══════════════════════════════════════════════════════════════
 * Replaces mock vectors with real OpenAI text-embedding-3-small.
 * Used by the Intelligence Module for RAG CVE/exploit search
 * and by the Memory Module for semantic session retrieval.
 * ═══════════════════════════════════════════════════════════════
 */

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIM = 1536;
const MAX_BATCH_SIZE = 100; // OpenAI limit per request

interface EmbeddingResult {
  vector: number[];
  model: string;
  tokensUsed: number;
}

/**
 * Generate a single embedding vector for the given text.
 * Falls back to a deterministic hash-based vector if no API key is configured.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_EMBEDDING_KEY;

  if (!apiKey) {
    console.warn(
      "[Embeddings] No OPENAI_API_KEY found — using deterministic fallback",
    );
    return deterministicFallback(text);
  }

  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[Embeddings] API error ${response.status}: ${errorBody}`);
      return deterministicFallback(text);
    }

    const data = await response.json();
    return data.data[0].embedding as number[];
  } catch (error: any) {
    console.error(
      `[Embeddings] Failed to generate embedding: ${error.message}`,
    );
    return deterministicFallback(text);
  }
}

/**
 * Generate embeddings for multiple texts in a single API call.
 * Automatically splits into batches of MAX_BATCH_SIZE.
 */
export async function generateEmbeddingsBatch(
  texts: string[],
): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_EMBEDDING_KEY;

  if (!apiKey) {
    console.warn(
      "[Embeddings] No OPENAI_API_KEY — batch using deterministic fallback",
    );
    return texts.map((t) => deterministicFallback(t));
  }

  const allEmbeddings: number[][] = [];

  // Process in batches
  for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
    const batch = texts.slice(i, i + MAX_BATCH_SIZE);

    try {
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: batch,
        }),
      });

      if (!response.ok) {
        console.error(`[Embeddings] Batch API error: ${response.status}`);
        allEmbeddings.push(...batch.map((t) => deterministicFallback(t)));
        continue;
      }

      const data = await response.json();
      const sorted = data.data.sort((a: any, b: any) => a.index - b.index);
      allEmbeddings.push(...sorted.map((d: any) => d.embedding as number[]));
    } catch (error: any) {
      console.error(`[Embeddings] Batch failed: ${error.message}`);
      allEmbeddings.push(...batch.map((t) => deterministicFallback(t)));
    }
  }

  return allEmbeddings;
}

/**
 * Build a search query embedding optimized for CVE/exploit retrieval.
 * Prepends context to improve RAG recall.
 */
export async function buildSearchEmbedding(
  serviceInfo: string,
  context?: { port?: number; protocol?: string; os?: string },
): Promise<number[]> {
  const parts = [serviceInfo];
  if (context?.port) parts.push(`port ${context.port}`);
  if (context?.protocol) parts.push(context.protocol);
  if (context?.os) parts.push(`operating system ${context.os}`);

  const searchQuery = `vulnerability exploit CVE for ${parts.join(" ")}`;
  return generateEmbedding(searchQuery);
}

/**
 * Deterministic hash-based fallback embedding.
 * Produces a consistent, non-random vector from text — NOT semantically meaningful,
 * but allows the pipeline to function without an API key during development.
 */
function deterministicFallback(text: string): number[] {
  const vector = new Array(EMBEDDING_DIM).fill(0);
  let hash = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }

  // Use the hash to seed a simple deterministic sequence
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    hash = ((hash * 1103515245 + 12345) | 0) & 0x7fffffff;
    vector[i] = (hash / 0x7fffffff) * 2 - 1; // Normalize to [-1, 1]
  }

  // L2 normalize
  const magnitude = Math.sqrt(
    vector.reduce((sum: number, v: number) => sum + v * v, 0),
  );
  if (magnitude > 0) {
    for (let i = 0; i < EMBEDDING_DIM; i++) {
      vector[i] /= magnitude;
    }
  }

  return vector;
}

export { EMBEDDING_MODEL, EMBEDDING_DIM };
