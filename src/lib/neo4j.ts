/**
 * ULTRON v3.0 — Neo4j / Graphiti Knowledge Graph Client
 * Lazy initialization to prevent crashes when servers are unavailable.
 */

import neo4j, { type Driver } from "neo4j-driver";

let driver: Driver | null = null;

function getDriver(): Driver {
  if (!driver) {
    driver = neo4j.driver(
      process.env.NEO4J_URI ?? process.env.MEMGRAPH_URI ?? "bolt://localhost:7687",
      neo4j.auth.basic(
        process.env.NEO4J_USER ?? process.env.MEMGRAPH_USER ?? "neo4j",
        process.env.NEO4J_PASSWORD ?? process.env.MEMGRAPH_PASSWORD ?? "",
      ),
    );
  }
  return driver;
}

export async function writeFindingToKG(
  sessionId: string,
  hostIp: string,
  vulnCve: string,
): Promise<void> {
  const session = getDriver().session();
  try {
    await session.run(
      `MERGE (h:Host {ip: $ip})
       MERGE (v:Vulnerability {cve: $cve})
       MERGE (h)-[:HAS_VULN {session: $session, discovered: datetime()}]->(v)`,
      { ip: hostIp, cve: vulnCve, session: sessionId },
    );
  } finally {
    await session.close();
  }
}

export async function closeDriver(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
  }
}
