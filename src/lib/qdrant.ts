import { QdrantClient } from '@qdrant/js-client-rest';
import { getEnv } from './validation/env';

const env = getEnv();
const qdrantUrl = env.qdrantUrl;
const qdrantApiKey = env.qdrantApiKey;

let qdrant: QdrantClient | null = null;
let isConnected = false;
let connectionError: Error | null = null;

/**
 * Initialize Qdrant connection with health check
 */
async function initializeQdrant() {
  try {
    console.log(`[Qdrant] Initializing connection to ${qdrantUrl}...`);
    
    const client = new QdrantClient({
      url: qdrantUrl,
      apiKey: qdrantApiKey,
    });

    // Health check
    try {
      await (client as any).health?.();
    } catch (e) {
      // If health endpoint fails, try a simple search
      await client.search('cve_exploits' as any, {
        vector: new Array(384).fill(0),
        limit: 1,
      } as any).catch(() => {
        throw new Error('Qdrant health check failed');
      });
    }

    qdrant = client;
    isConnected = true;
    connectionError = null;
    
    console.log('✅ [Qdrant] Connection successful');
    return true;
  } catch (error: any) {
    isConnected = false;
    connectionError = error;
    console.error(`❌ [Qdrant] Connection failed: ${error.message}`);
    console.error('[Qdrant] Continuing without vector search. RAG context will be unavailable.');
    return false;
  }
}

// Initialize on module load
initializeQdrant().catch(console.error);

/**
 * Check if Qdrant is connected
 */
export function isQdrantConnected() {
  return isConnected && qdrant !== null;
}

/**
 * Get Qdrant client (may be null if not connected)
 */
export function getQdrantClient() {
  return qdrant;
}

/**
 * Get last connection error (if any)
 */
export function getQdrantError() {
  return connectionError;
}

/**
 * Search CVEs with graceful degradation
 * Returns empty array if Qdrant unavailable
 */
export async function searchCVEs(
  queryVector: number[],
  collection: string = 'cve_exploits',
  topK: number = 5
): Promise<any[]> {
  if (!qdrant || !isConnected) {
    console.warn(
      `[Qdrant] Search unavailable - vector DB disconnected. ` +
      `Coordinator will continue without RAG context.`
    );
    return [];
  }

  try {
    const results = await qdrant.search(collection as any, {
      vector: queryVector,
      limit: topK,
    } as any);

    return results;
  } catch (error: any) {
    console.error(`[Qdrant] Search error: ${error.message}`);
    console.warn('[Qdrant] Gracefully degrading - skipping RAG context for this iteration.');
    isConnected = false; // Mark as disconnected on failure
    return [];
  }
}

/**
 * Get Qdrant client for backward compatibility
 */
export const qdrant_deprecated = qdrant;

