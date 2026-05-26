/**
 * ULTRON v3.0 — Memory Module
 * Stores findings to knowledge graph and Convex persistence layer.
 */

import type { Finding, FlowTask } from "../flow";

export async function storeMemory(
  sessionId: string,
  task: FlowTask,
  findings: Finding[],
): Promise<void> {
  console.log(
    `[Memory] Storing ${findings.length} findings for task "${task.title}" in session ${sessionId}`,
  );

  for (const finding of findings) {
    if (finding.type === "vulnerability" && finding.cve_ids.length > 0) {
      console.log(`[Memory] CVE finding: ${finding.cve_ids.join(", ")}`);
      // TODO: Write to Graphiti knowledge graph
      // TODO: Store in Convex observability_events
    }
  }
}
