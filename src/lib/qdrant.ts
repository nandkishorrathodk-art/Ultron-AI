/**
 * ULTRON v3.0 — Vector Search Client
 * Supports Qdrant standalone or pgvector (via API adapter).
 * Lazy initialization to prevent crashes when servers are unavailable.
 */

import { QdrantClient } from "@qdrant/js-client-rest";

let client: QdrantClient | null = null;

function getClient(): QdrantClient {
  if (!client) {
    client = new QdrantClient({
      url: process.env.QDRANT_URL ?? "http://localhost:6333",
      apiKey: process.env.QDRANT_API_KEY,
    });
  }
  return client;
}

interface SearchResult {
  id: string | number;
  score: number;
  payload: Record<string, unknown>;
}

export async function searchCVEs(
  queryVector: number[],
  collection = "cve_exploits",
  topK = 5,
): Promise<SearchResult[]> {
  const results = await getClient().search(collection, {
    vector: queryVector,
    limit: topK,
  });

  return results.map((r) => ({
    id: r.id,
    score: r.score,
    payload: (r.payload ?? {}) as Record<string, unknown>,
  }));
}
