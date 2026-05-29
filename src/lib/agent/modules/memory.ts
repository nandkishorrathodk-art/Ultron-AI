/* eslint-disable @typescript-eslint/no-explicit-any */
import { Finding, PTGNode, PenetrationTaskGraph } from "../ptg";
import { writeFindingToKG, kgClient } from "../../neo4j";
import { qdrant } from "../../qdrant";
import { generateEmbedding } from "../../embeddings";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import crypto from "crypto";

const convexUrl =
  process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL || "";
const convexClient = convexUrl ? new ConvexHttpClient(convexUrl) : null;

// Short-term memory: Current session findings in-memory
const sessionCache = new Map<string, Finding[]>();

/**
 * 4-Tier Memory System:
 * 1. Short-term: Session-specific findings cache (in-memory)
 * 2. Mid-term: Convex persistence for conversation messages & PTG states
 * 3. Long-term: Neo4j knowledge graph mapping all findings & dependencies
 * 4. Vector Memory: Qdrant for semantic search & cross-session retrieval
 */
export async function storeMemory(
  sessionId: string,
  task: PTGNode,
  findings: Finding[],
  ptg?: PenetrationTaskGraph,
) {
  console.log(
    `[Module: Memory] Storing ${findings.length} findings for session ${sessionId}`,
  );

  if (findings.length === 0) return;

  // 1. Short-term Memory (In-Memory Cache)
  const cached = sessionCache.get(sessionId) || [];
  cached.push(...findings);
  sessionCache.set(sessionId, cached);

  // 2. Long-term Memory: Neo4j Knowledge Graph (Detailed mapping of findings)
  const neoSession = kgClient.session();
  try {
    const hostIp = findings[0]?.endpoint || "192.168.1.1"; // Use finding endpoint or default IP

    // Create base session and host nodes
    await neoSession.run(
      `
      MERGE (s:Session {id: $sessionId})
      MERGE (h:Host {ip: $hostIp})
      MERGE (s)-[:TARGETS]->(h)
    `,
      { sessionId, hostIp },
    );

    for (const finding of findings) {
      if (finding.type === "vulnerability") {
        const cve =
          finding.cve_ids[0] || `VULN-${crypto.randomUUID().substring(0, 8)}`;
        await neoSession.run(
          `
          MERGE (v:Vulnerability {cve_id: $cve})
          ON CREATE SET v.description = $desc, v.severity = $severity, v.cvss = $cvss
          MERGE (h:Host {ip: $hostIp})
          MERGE (h)-[:AFFECTED_BY]->(v)
          MERGE (s:Session {id: $sessionId})
          MERGE (v)-[:EXPLOITED_BY]->(s)
        `,
          {
            cve,
            desc: finding.description,
            severity: finding.severity,
            cvss: finding.cvss_score || 0,
            hostIp,
            sessionId,
          },
        );
      } else if (finding.type === "open_port") {
        const portMatch = finding.description.match(/\b\d+\b/);
        const portNum = portMatch ? parseInt(portMatch[0]) : 80;
        await neoSession.run(
          `
          MERGE (p:Port {port: $portNum})
          MERGE (h:Host {ip: $hostIp})
          MERGE (h)-[:HAS_PORT]->(p)
        `,
          { portNum, hostIp },
        );
      } else if (finding.type === "service") {
        await neoSession.run(
          `
          MERGE (serv:Service {name: $desc})
          MERGE (h:Host {ip: $hostIp})
          MERGE (h)-[:RUNS_SERVICE]->(serv)
        `,
          { desc: finding.description, hostIp },
        );
      } else if (finding.type === "credential") {
        await neoSession.run(
          `
          MERGE (c:Credential {info: $desc})
          MERGE (h:Host {ip: $hostIp})
          MERGE (h)-[:HAS_CREDENTIAL]->(c)
        `,
          { desc: finding.description, hostIp },
        );
      } else if (finding.type === "shell_access") {
        await neoSession.run(
          `
          MERGE (sa:ShellAccess {details: $desc})
          MERGE (h:Host {ip: $hostIp})
          MERGE (h)-[:HAS_SHELL]->(sa)
        `,
          { desc: finding.description, hostIp },
        );
      }
    }
  } catch (error) {
    console.error("[Memory: Neo4j Error]", error);
  } finally {
    await neoSession.close();
  }

  // 3. Vector Memory: Qdrant Indexing
  for (const finding of findings) {
    try {
      const embeddingText = `Finding type: ${finding.type}\nSeverity: ${finding.severity}\nDescription: ${finding.description}\nEvidence: ${finding.evidence}`;
      const vector = await generateEmbedding(embeddingText);
      const pointId = crypto.randomUUID();

      await qdrant.upsert("pentest_findings", {
        wait: true,
        points: [
          {
            id: pointId,
            vector,
            payload: {
              sessionId,
              taskId: task.task_id,
              type: finding.type,
              severity: finding.severity,
              description: finding.description,
              cvss: finding.cvss_score || 0,
              epss: finding.epss_score || 0,
              mitre: finding.mitre_technique || "",
              timestamp: Date.now(),
            },
          },
        ],
      });
      console.log(
        `[Memory: Qdrant] Indexed finding in Qdrant: ${finding.description.slice(0, 50)}...`,
      );
    } catch (error) {
      console.error("[Memory: Qdrant Error]", error);
    }
  }

  // 4. Mid-term Memory: Convex Sync (Syncing serialized PTG state)
  if (ptg && convexClient) {
    try {
       
      const convexSessionId = sessionId as any;
      await convexClient.mutation(api.sessions.updatePTG, {
        id: convexSessionId,
        ptgState: ptg.serialize(),
      });
      console.log(
        `[Memory: Convex] Synced PTG state to Convex for session ${sessionId}`,
      );
    } catch (error) {
      console.error("[Memory: Convex Sync Error]", error);
    }
  }
}

/**
 * Retrieve findings from memory using semantic search (Qdrant) across all past sessions.
 */
 
export async function searchPastFindings(
  query: string,
  limit = 5,
): Promise<any[]> {
  try {
    const vector = await generateEmbedding(query);
    const results = await qdrant.search("pentest_findings", {
      vector,
      limit,
    });
    return results.map((r) => r.payload);
  } catch (error) {
    console.error("[Memory: Search Past Findings Error]", error);
    return [];
  }
}
