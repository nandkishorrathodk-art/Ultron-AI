/**
 * Intelligence Module v2.0 — Real RAG + MITRE + Exploit Ranking
 * ═══════════════════════════════════════════════════════════════
 * UPGRADES:
 *  - Real embeddings via OpenAI (replaces mock vectors)
 *  - MITRE ATT&CK technique lookup
 *  - Exploit ranking by CVSS + EPSS + recency
 *  - Knowledge Graph query for attack paths
 *  - Context-rich intelligence for the Generation Module
 * ═══════════════════════════════════════════════════════════════
 */

import { searchCVEs } from "../../qdrant";
import { kgClient } from "../../neo4j";
import { generateEmbedding, buildSearchEmbedding } from "../../embeddings";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IntelligenceContext {
  cve_recommendations: CVERecommendation[];
  mitre_techniques: MITRETechnique[];
  kg_paths: AttackPath[];
  exploit_candidates: ExploitCandidate[];
  contextSummary: string;
}

export interface CVERecommendation {
  cve_id: string;
  description: string;
  cvss_score: number;
  epss_score: number;
  exploit_available: boolean;
  metasploit_module?: string;
  relevance_score: number;    // Qdrant similarity score
}

export interface MITRETechnique {
  id: string;
  name: string;
  tactic: string;
  url: string;
}

export interface AttackPath {
  from: string;
  to: string;
  via: string;
  hops: number;
}

export interface ExploitCandidate {
  cve_id: string;
  tool: string;              // Which tool to use (metasploit, sqlmap, etc.)
  command: string;           // Suggested command
  risk_level: "green" | "yellow" | "red";
  success_probability: number; // Estimated 0-1
  priority: number;          // Ranking among candidates
}

// ─── MITRE ATT&CK Mapping ────────────────────────────────────────────────────

const MITRE_MAP: Record<string, MITRETechnique> = {
  "T1190": {
    id: "T1190",
    name: "Exploit Public-Facing Application",
    tactic: "Initial Access",
    url: "https://attack.mitre.org/techniques/T1190/",
  },
  "T1046": {
    id: "T1046",
    name: "Network Service Discovery",
    tactic: "Discovery",
    url: "https://attack.mitre.org/techniques/T1046/",
  },
  "T1595.002": {
    id: "T1595.002",
    name: "Active Scanning: Vulnerability Scanning",
    tactic: "Reconnaissance",
    url: "https://attack.mitre.org/techniques/T1595/002/",
  },
  "T1059": {
    id: "T1059",
    name: "Command and Scripting Interpreter",
    tactic: "Execution",
    url: "https://attack.mitre.org/techniques/T1059/",
  },
  "T1059.004": {
    id: "T1059.004",
    name: "Unix Shell",
    tactic: "Execution",
    url: "https://attack.mitre.org/techniques/T1059/004/",
  },
  "T1059.007": {
    id: "T1059.007",
    name: "JavaScript",
    tactic: "Execution",
    url: "https://attack.mitre.org/techniques/T1059/007/",
  },
  "T1078": {
    id: "T1078",
    name: "Valid Accounts",
    tactic: "Defense Evasion",
    url: "https://attack.mitre.org/techniques/T1078/",
  },
  "T1068": {
    id: "T1068",
    name: "Exploitation for Privilege Escalation",
    tactic: "Privilege Escalation",
    url: "https://attack.mitre.org/techniques/T1068/",
  },
  "T1003": {
    id: "T1003",
    name: "OS Credential Dumping",
    tactic: "Credential Access",
    url: "https://attack.mitre.org/techniques/T1003/",
  },
  "T1021": {
    id: "T1021",
    name: "Remote Services",
    tactic: "Lateral Movement",
    url: "https://attack.mitre.org/techniques/T1021/",
  },
  "T1018": {
    id: "T1018",
    name: "Remote System Discovery",
    tactic: "Discovery",
    url: "https://attack.mitre.org/techniques/T1018/",
  },
  "T1090": {
    id: "T1090",
    name: "Proxy",
    tactic: "Command and Control",
    url: "https://attack.mitre.org/techniques/T1090/",
  },
  "T1005": {
    id: "T1005",
    name: "Data from Local System",
    tactic: "Collection",
    url: "https://attack.mitre.org/techniques/T1005/",
  },
  "T1083": {
    id: "T1083",
    name: "File and Directory Discovery",
    tactic: "Discovery",
    url: "https://attack.mitre.org/techniques/T1083/",
  },
  "T1592": {
    id: "T1592",
    name: "Gather Victim Host Information",
    tactic: "Reconnaissance",
    url: "https://attack.mitre.org/techniques/T1592/",
  },
  "T1590": {
    id: "T1590",
    name: "Gather Victim Network Information",
    tactic: "Reconnaissance",
    url: "https://attack.mitre.org/techniques/T1590/",
  },
  "T1590.002": {
    id: "T1590.002",
    name: "DNS",
    tactic: "Reconnaissance",
    url: "https://attack.mitre.org/techniques/T1590/002/",
  },
  "T1588.005": {
    id: "T1588.005",
    name: "Exploits",
    tactic: "Resource Development",
    url: "https://attack.mitre.org/techniques/T1588/005/",
  },
  "T1505.003": {
    id: "T1505.003",
    name: "Web Shell",
    tactic: "Persistence",
    url: "https://attack.mitre.org/techniques/T1505/003/",
  },
  "T1528": {
    id: "T1528",
    name: "Steal Application Access Token",
    tactic: "Credential Access",
    url: "https://attack.mitre.org/techniques/T1528/",
  },
  "T1557": {
    id: "T1557",
    name: "Adversary-in-the-Middle",
    tactic: "Credential Access",
    url: "https://attack.mitre.org/techniques/T1557/",
  },
  "T1574": {
    id: "T1574",
    name: "Hijack Execution Flow",
    tactic: "Defense Evasion",
    url: "https://attack.mitre.org/techniques/T1574/",
  },
};

/**
 * Look up MITRE ATT&CK techniques for a given phase.
 */
function getMITRETechniques(
  phase: string,
  serviceInfo?: string
): MITRETechnique[] {
  const phaseMap: Record<string, string[]> = {
    recon: ["T1595.002", "T1592", "T1590", "T1590.002"],
    enum: ["T1046", "T1083"],
    vuln: ["T1595.002", "T1588.005"],
    exploit: ["T1190", "T1059", "T1059.004", "T1059.007"],
    post: ["T1068", "T1003", "T1021", "T1018", "T1005"],
    report: [],
  };

  const techniqueIds = phaseMap[phase] || [];
  return techniqueIds
    .map((id) => MITRE_MAP[id])
    .filter((t): t is MITRETechnique => !!t);
}

// ─── Knowledge Graph Query ────────────────────────────────────────────────────

async function queryKGPaths(sessionId: string, hostIp?: string): Promise<AttackPath[]> {
  try {
    const session = kgClient.session();
    try {
      const result = await session.run(
        `
        MATCH path = (start:Host)-[*..5]->(end)
        WHERE start.ip = $hostIp OR $hostIp IS NULL
        RETURN 
          start.ip AS fromHost,
          labels(end)[0] AS toType,
          type(last(relationships(path))) AS via,
          length(path) AS hops
        LIMIT 20
        `,
        { hostIp: hostIp || null }
      );

      return result.records.map((record) => ({
        from: record.get("fromHost") || "unknown",
        to: record.get("toType") || "unknown",
        via: record.get("via") || "unknown",
        hops: record.get("hops")?.toNumber?.() || 0,
      }));
    } finally {
      await session.close();
    }
  } catch (err: any) {
    // KG may not be running in dev mode
    console.log(`[Intelligence] KG query skipped: ${err.message}`);
    return [];
  }
}

// ─── Main Intelligence Function ───────────────────────────────────────────────

/**
 * Gather intelligence for a task based on service info.
 * Queries RAG (Qdrant), MITRE ATT&CK, and Knowledge Graph.
 */
export async function gatherIntelligence(
  serviceInfo: string,
  options: {
    phase?: string;
    hostIp?: string;
    sessionId?: string;
    port?: number;
    protocol?: string;
  } = {}
): Promise<IntelligenceContext> {
  console.log(`[Intelligence] Gathering intelligence for: "${serviceInfo}"`);

  // 1. RAG: Search CVE database
  let cve_recommendations: CVERecommendation[] = [];
  try {
    const queryVector = await buildSearchEmbedding(serviceInfo, {
      port: options.port,
      protocol: options.protocol,
    });

    const results = await searchCVEs(queryVector, "cve_exploits", 10);

    cve_recommendations = results.map((r: any) => ({
      cve_id: r.payload?.cve_id || "unknown",
      description: r.payload?.description || "",
      cvss_score: r.payload?.cvss_score || 0,
      epss_score: r.payload?.epss_score || 0,
      exploit_available: r.payload?.exploit_available || false,
      metasploit_module: r.payload?.metasploit_module,
      relevance_score: r.score || 0,
    }));

    // Rank by: CVSS * EPSS * relevance (higher = more dangerous + more likely to succeed)
    cve_recommendations.sort((a, b) => {
      const scoreA = a.cvss_score * (a.epss_score || 0.01) * a.relevance_score;
      const scoreB = b.cvss_score * (b.epss_score || 0.01) * b.relevance_score;
      return scoreB - scoreA;
    });

    console.log(`[Intelligence] Found ${cve_recommendations.length} CVE recommendations`);
  } catch (err: any) {
    console.log(`[Intelligence] RAG search failed: ${err.message}`);
  }

  // 2. MITRE ATT&CK techniques
  const mitre_techniques = getMITRETechniques(options.phase || "recon", serviceInfo);
  console.log(`[Intelligence] Mapped ${mitre_techniques.length} MITRE techniques`);

  // 3. Knowledge Graph paths
  const kg_paths = await queryKGPaths(options.sessionId || "", options.hostIp);

  // 4. Build exploit candidates from CVE recommendations
  const exploit_candidates: ExploitCandidate[] = cve_recommendations
    .filter((c) => c.exploit_available || c.cvss_score >= 7.0)
    .slice(0, 5)
    .map((cve, i) => ({
      cve_id: cve.cve_id,
      tool: cve.metasploit_module ? "metasploit" : "searchsploit",
      command: cve.metasploit_module
        ? `msfconsole -q -x "use ${cve.metasploit_module}; set RHOSTS TARGET; exploit"`
        : `searchsploit "${cve.cve_id}"`,
      risk_level: cve.cvss_score >= 9.0 ? "red" as const : cve.cvss_score >= 7.0 ? "yellow" as const : "green" as const,
      success_probability: Math.min(cve.epss_score * 2, 0.95), // Scale up EPSS
      priority: i + 1,
    }));

  // 5. Build context summary for the LLM
  const contextSummary = buildContextSummary(
    serviceInfo,
    cve_recommendations,
    mitre_techniques,
    kg_paths
  );

  return {
    cve_recommendations,
    mitre_techniques,
    kg_paths,
    exploit_candidates,
    contextSummary,
  };
}

function buildContextSummary(
  serviceInfo: string,
  cves: CVERecommendation[],
  mitre: MITRETechnique[],
  kgPaths: AttackPath[]
): string {
  const parts: string[] = [`Service: ${serviceInfo}`];

  if (cves.length > 0) {
    parts.push(`\nTop CVEs:`);
    for (const cve of cves.slice(0, 5)) {
      parts.push(
        `- ${cve.cve_id} (CVSS: ${cve.cvss_score}, EPSS: ${cve.epss_score}) ${cve.exploit_available ? "⚡ Exploit available" : ""}`
      );
    }
  }

  if (mitre.length > 0) {
    parts.push(`\nMITRE Techniques: ${mitre.map((m) => `${m.id} (${m.name})`).join(", ")}`);
  }

  if (kgPaths.length > 0) {
    parts.push(`\nKnown attack paths: ${kgPaths.length} paths from KG`);
  }

  return parts.join("\n");
}
