import neo4j from 'neo4j-driver';
import { getEnv } from './validation/env';

// Initialize Neo4j driver
// In development, this will fail gracefully if keys aren't provided yet
const env = getEnv();
const uri = env.neo4jUri;
const user = env.neo4jUser;
const password = env.neo4jPassword;

let kgClient: any = null;
let isConnected = false;
let connectionError: Error | null = null;

/**
 * Initialize Neo4j connection with retry logic
 */
async function initializeConnection() {
  try {
    console.log(`[Neo4j] Initializing connection to ${uri}...`);
    
    const driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
      connectionTimeout: 5000,
      disableLosslessIntegers: true,
    });

    // Test connection
    const session = driver.session();
    await session.run('RETURN 1 as test');
    await session.close();

    kgClient = driver;
    isConnected = true;
    connectionError = null;
    
    console.log('✅ [Neo4j] Connection successful');
    return true;
  } catch (error: any) {
    isConnected = false;
    connectionError = error;
    console.error(`❌ [Neo4j] Connection failed: ${error.message}`);
    console.error('[Neo4j] Continuing without knowledge graph. Features will be degraded.');
    return false;
  }
}

// Initialize on module load
initializeConnection().catch(console.error);

/**
 * Get Neo4j client (may be null if not connected)
 */
export function getNeo4jClient() {
  return kgClient;
}

/**
 * Check if Neo4j is connected
 */
export function isNeo4jConnected() {
  return isConnected && kgClient !== null;
}

/**
 * Get last connection error (if any)
 */
export function getNeo4jError() {
  return connectionError;
}

/**
 * Write finding to knowledge graph with fallback
 */
export async function writeFindingToKG(
  sessionId: string,
  hostIp: string,
  vulnCve: string
): Promise<boolean> {
  if (!kgClient || !isConnected) {
    console.warn(
      `[Neo4j] Skipping finding write - knowledge graph unavailable. ` +
      `(Finding: ${hostIp} → ${vulnCve})`
    );
    return false;
  }

  const session = kgClient.session();
  try {
    // Basic Cypher query to log an attack path
    await session.run(
      `
      MERGE (h:Host {ip: $hostIp})
      MERGE (v:Vulnerability {cve_id: $vulnCve})
      MERGE (h)-[:AFFECTED_BY]->(v)
      MERGE (s:Session {id: $sessionId})
      MERGE (v)-[:EXPLOITED_BY]->(s)
    `,
      { hostIp, vulnCve, sessionId }
    );

    console.log(`[Neo4j] Finding written: ${hostIp} → ${vulnCve}`);
    return true;
  } catch (error: any) {
    console.error(`[Neo4j] Write failed: ${error.message}`);
    isConnected = false; // Mark as disconnected on failure
    return false;
  } finally {
    await session.close();
  }
}

/**
 * Query attack paths with fallback
 */
export async function queryAttackPaths(hostIp: string): Promise<any[]> {
  if (!kgClient || !isConnected) {
    console.warn(`[Neo4j] Skipping attack path query - knowledge graph unavailable.`);
    return [];
  }

  const session = kgClient.session();
  try {
    const result = await session.run(
      `
      MATCH (h:Host {ip: $hostIp})-[:AFFECTED_BY]->(v:Vulnerability)
      RETURN h, v
    `,
      { hostIp }
    );

    return result.records.map((record) => ({
      host: record.get('h').properties,
      vulnerability: record.get('v').properties,
    }));
  } catch (error: any) {
    console.error(`[Neo4j] Query failed: ${error.message}`);
    isConnected = false;
    return [];
  } finally {
    await session.close();
  }
}

/**
 * Export original client for backward compatibility
 */
export const kgClient_deprecated = kgClient;

