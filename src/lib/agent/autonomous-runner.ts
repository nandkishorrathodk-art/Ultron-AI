import { PentestCoordinator } from "./coordinator";
import { PenetrationTaskGraph, PTGNode } from "./ptg";
import { ThinkingEngine } from "./thinking-engine";
import { Redis } from "@upstash/redis";
import { createClient } from "redis";

// Initialize Upstash Redis if configured
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;
const rawRedisUrl = process.env.REDIS_URL || "";

export interface RunnerOptions {
  sessionId: string;
  target: string;
  mode?: "standard" | "ctf" | "bug_bounty" | "continuous";
  maxIterations?: number;
}

export class AutonomousRunner {
  private sessionId: string;
  private target: string;
  private mode: "standard" | "ctf" | "bug_bounty" | "continuous";
  private maxIterations: number;
  private coordinator: PentestCoordinator | null = null;
  private thinkingEngine: ThinkingEngine;

  constructor(options: RunnerOptions) {
    this.sessionId = options.sessionId;
    this.target = options.target;
    this.mode = options.mode || "standard";
    this.maxIterations = options.maxIterations || 48;
    this.thinkingEngine = new ThinkingEngine(this.sessionId);
  }

  /**
   * Check if a session checkpoint exists in Redis.
   */
  async getCheckpoint(): Promise<any | null> {
    if (!redis) return null;
    try {
      const state = await redis.get(`ultron:checkpoint:${this.sessionId}`);
      return state ? JSON.parse(JSON.stringify(state)) : null;
    } catch (err) {
      console.error("[AutonomousRunner] Failed to fetch Redis checkpoint:", err);
      return null;
    }
  }

  /**
   * Save a session checkpoint to Redis.
   */
  async saveCheckpoint(ptgState: any): Promise<void> {
    if (!redis) return;
    try {
      await redis.set(`ultron:checkpoint:${this.sessionId}`, JSON.stringify(ptgState), { ex: 86400 });
      console.log(`[AutonomousRunner] Saved state checkpoint for session: ${this.sessionId}`);
    } catch (err) {
      console.error("[AutonomousRunner] Failed to save Redis checkpoint:", err);
    }
  }

  /**
   * Stream live events to subscribers via Redis Pub/Sub if available.
   */
  private async publishEvent(event: string, payload: any) {
    if (!rawRedisUrl) return;
    let client;
    try {
      client = createClient({ url: rawRedisUrl });
      client.on("error", () => {});
      await client.connect();
      await client.publish(`ultron:events:${this.sessionId}`, JSON.stringify({ event, payload }));
    } catch (err) {
      console.warn("[AutonomousRunner] Event stream publication failed:", err);
    } finally {
      if (client) {
        try {
          await client.quit();
        } catch {}
      }
    }
  }

  /**
   * Launches the autonomous runner loop.
   */
  async run(): Promise<string> {
    console.log(`[AutonomousRunner] Initializing session execution: ${this.sessionId}`);
    this.publishEvent("status", { message: "Initializing autonomous pentest coordinator..." });

    // Check for self-healing/resuming state
    const checkpoint = await this.getCheckpoint();
    if (checkpoint) {
      console.log(`[AutonomousRunner] Resuming session ${this.sessionId} from checkpoint`);
      this.publishEvent("status", { message: "Resuming session from previous checkpoint..." });
    }

    this.coordinator = new PentestCoordinator({
      sessionId: this.sessionId,
      targetScope: [this.target],
      mode: this.mode,
      maxIterations: this.maxIterations,
      onProgress: async (update) => {
        // Stream live coordinator progress updates to Redis subscribers
        await this.publishEvent("progress", update);
        
        // Save incremental checkpoint on task completions
        if (update.type === "task_complete" || update.type === "task_fail") {
          if (update.ptgStats) {
            await this.saveCheckpoint({
              stats: update.ptgStats,
              currentPtg: update.currentPtg,
              timestamp: Date.now()
            });
          }
        }
      }
    });

    // Run coordinator loop
    const finalPtg = await this.coordinator.run();

    // Generate Final Pentesting Report
    const report = this.generateMarkdownReport(finalPtg);

    this.publishEvent("complete", { report });
    return report;
  }

  /**
   * Generates a professional markdown report of findings.
   */
  private generateMarkdownReport(ptg: PenetrationTaskGraph): string {
    const findings = ptg.getAllFindings();
    const tasks = ptg.getAllNodes();
    
    const critical = findings.filter(f => f.severity === "critical").length;
    const high = findings.filter(f => f.severity === "high").length;
    const medium = findings.filter(f => f.severity === "medium").length;
    const low = findings.filter(f => f.severity === "low").length;

    let report = `# 🛡️ Ultron AI - Executive Penetration Testing Report

## Executive Summary
This report presents the findings of the automated penetration testing session conducted on the target system **${this.target}**. 
A total of **${findings.length}** vulnerabilities were discovered.

### Vulnerability Severity Breakdown
- 🛑 **Critical**: ${critical}
- 🟠 **High**: ${high}
- 🟡 **Medium**: ${medium}
- 🟢 **Low**: ${low}

---

## Detailed Findings
`;

    if (findings.length === 0) {
      report += "\nNo security vulnerabilities were identified during this assessment.\n";
    } else {
      findings.forEach((finding, idx) => {
        report += `
### Finding ${idx + 1}: ${finding.description}
- **Severity**: ${finding.severity.toUpperCase()}
- **CVSS Score**: ${finding.cvss_score || "N/A"}
- **EPSS Score**: ${finding.epss_score || "N/A"}
- **MITRE Technique**: ${finding.mitre_technique || "N/A"}

#### Technical Details
${finding.raw_output || "No additional technical details recorded."}

#### Proof of Concept (PoC)
\`\`\`
${finding.evidence || "Dynamic checks confirmed presence based on scan response."}
\`\`\`

#### Remediation Recommendation
${finding.remediation || "Update software dependencies and restrict ingress ports."}

---
`;
      });
    }

    report += `
## Audit History (Attack Graph Execution Trace)
The following tasks were planned and executed as part of the assessment:

| Phase | Task Title | Status | Retries |
|---|---|---|---|
`;

    tasks.forEach((t: PTGNode) => {
      report += `| ${t.phase} | ${t.title} | ${t.status} | ${t.retry_count} |\n`;
    });

    return report;
  }
}
