/**
 * Vulnerability Chaining Engine
 * ═══════════════════════════════════════════════════════════════
 * Combines multiple low/medium severity findings into high-impact
 * attack chains. This is what XBOW does with its 48-step chains.
 *
 * Example chains:
 *  - SSRF + File Upload = RCE
 *  - IDOR + Info Disclosure = Account Takeover
 *  - Open Redirect + XSS = Session Hijacking
 *  - SQL Injection + File Read = Database Dump
 * ═══════════════════════════════════════════════════════════════
 */

import { Finding } from "../ptg";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AttackChain {
  chain_id: string;
  name: string;
  description: string;
  steps: ChainStep[];
  combined_impact: "low" | "medium" | "high" | "critical";
  original_severities: string[];
  cvss_estimated: number;
  mitre_techniques: string[];
  remediation: string;
}

export interface ChainStep {
  order: number;
  finding: Finding;
  role: string;       // What this finding contributes to the chain
  transition: string; // How this step connects to the next
}

// ─── Known Chain Patterns ─────────────────────────────────────────────────────

interface ChainPattern {
  name: string;
  description: string;
  required: string[];       // Finding description keywords needed
  optional: string[];       // Additional findings that strengthen the chain
  combined_impact: "high" | "critical";
  cvss_estimated: number;
  mitre_techniques: string[];
  remediation: string;
  roles: string[];          // Role of each required finding in the chain
  transitions: string[];    // How findings connect
}

const KNOWN_CHAINS: ChainPattern[] = [
  {
    name: "SSRF → Internal Service Access → RCE",
    description: "Server-Side Request Forgery used to access internal services, leading to Remote Code Execution",
    required: ["ssrf", "rce"],
    optional: ["internal", "metadata", "cloud"],
    combined_impact: "critical",
    cvss_estimated: 9.8,
    mitre_techniques: ["T1090", "T1190"],
    remediation: "Implement strict URL validation, block internal IP ranges, use allowlists for outbound requests",
    roles: ["Entry point — forge server-side request to internal target", "Exploitation — execute code on internal service"],
    transitions: ["SSRF allows reaching internal service →", "Internal service vulnerable to RCE"],
  },
  {
    name: "File Upload + Path Traversal → RCE",
    description: "Unrestricted file upload combined with path traversal to write webshell in executable location",
    required: ["file upload", "path traversal"],
    optional: ["webshell", "rce"],
    combined_impact: "critical",
    cvss_estimated: 9.8,
    mitre_techniques: ["T1505.003", "T1083"],
    remediation: "Validate file types, randomize upload filenames, store uploads outside webroot, disable execution in upload directory",
    roles: ["Upload malicious file (webshell/payload)", "Traverse path to place file in executable directory"],
    transitions: ["Malicious file uploaded →", "Path traversal moves file to webroot → Shell execution"],
  },
  {
    name: "IDOR + Information Disclosure → Account Takeover",
    description: "Insecure Direct Object Reference combined with info leak to access other users' data or accounts",
    required: ["idor", "information disclosure"],
    optional: ["account", "user", "credential", "token"],
    combined_impact: "high",
    cvss_estimated: 8.6,
    mitre_techniques: ["T1078", "T1528"],
    remediation: "Implement proper authorization checks, use indirect references (UUIDs), validate ownership on every request",
    roles: ["Access unauthorized resources via predictable IDs", "Extract sensitive data (tokens, credentials, PII)"],
    transitions: ["IDOR reveals other users' data →", "Leaked data enables full account access"],
  },
  {
    name: "Open Redirect + XSS → Session Hijacking",
    description: "Open redirect chains into reflected XSS to steal session cookies",
    required: ["open redirect", "xss"],
    optional: ["cookie", "session", "token"],
    combined_impact: "high",
    cvss_estimated: 8.1,
    mitre_techniques: ["T1557", "T1059.007"],
    remediation: "Validate redirect URLs against allowlist, implement CSP headers, use HttpOnly cookies",
    roles: ["Redirect user to attacker-controlled page via trusted domain", "Execute JavaScript to steal session cookie"],
    transitions: ["Trusted redirect lowers user suspicion →", "XSS payload executes in user's session"],
  },
  {
    name: "SQL Injection + File Read → Data Exfiltration",
    description: "SQL injection used to read local files via LOAD_FILE or similar, exfiltrating sensitive configuration",
    required: ["sql injection", "file"],
    optional: ["credential", "config", "password", "database"],
    combined_impact: "critical",
    cvss_estimated: 9.1,
    mitre_techniques: ["T1190", "T1005"],
    remediation: "Use parameterized queries, restrict DB file access privileges, encrypt sensitive configuration files",
    roles: ["Inject SQL to execute file read operations", "Exfiltrate sensitive files (config, credentials, keys)"],
    transitions: ["SQLi provides DB access →", "LOAD_FILE/INTO OUTFILE reads/writes server files"],
  },
  {
    name: "Authentication Bypass + Privilege Escalation → Admin Takeover",
    description: "Auth bypass combined with privilege escalation to gain full admin access",
    required: ["auth", "privilege escalation"],
    optional: ["admin", "root", "superuser"],
    combined_impact: "critical",
    cvss_estimated: 9.8,
    mitre_techniques: ["T1078", "T1068"],
    remediation: "Implement robust authentication, enforce least privilege, audit admin access paths",
    roles: ["Bypass authentication to gain initial access", "Escalate privileges to admin/root level"],
    transitions: ["Auth bypass provides user-level access →", "Privilege escalation grants full admin control"],
  },
  {
    name: "XXE + SSRF → Internal Network Scan",
    description: "XML External Entity injection chains into SSRF to scan and access internal network resources",
    required: ["xxe", "ssrf"],
    optional: ["internal", "network", "scan"],
    combined_impact: "high",
    cvss_estimated: 8.6,
    mitre_techniques: ["T1190", "T1046"],
    remediation: "Disable XML external entities, validate XML input, implement network segmentation",
    roles: ["Inject XML external entity to trigger server-side requests", "Enumerate internal network via SSRF"],
    transitions: ["XXE triggers outbound request →", "SSRF scans internal hosts and services"],
  },
  {
    name: "CORS Misconfiguration + XSS → Cross-Origin Data Theft",
    description: "Overly permissive CORS combined with XSS to steal data cross-origin",
    required: ["cors", "xss"],
    optional: ["cross-origin", "api", "token"],
    combined_impact: "high",
    cvss_estimated: 7.5,
    mitre_techniques: ["T1557", "T1059.007"],
    remediation: "Restrict CORS origins to trusted domains, implement CSP, validate Origin headers",
    roles: ["Permissive CORS allows cross-origin requests with credentials", "XSS on allowed origin enables data theft"],
    transitions: ["CORS allows attacker domain →", "XSS steals authenticated data cross-origin"],
  },
];

// ─── Chain Detection ──────────────────────────────────────────────────────────

/**
 * Analyze findings to detect known vulnerability chain patterns.
 */
export function detectChains(findings: Finding[]): AttackChain[] {
  const chains: AttackChain[] = [];
  const findingDescriptions = findings.map((f) => f.description.toLowerCase());

  for (const pattern of KNOWN_CHAINS) {
    // Check if all required components are present in findings
    const matchedFindings: Finding[] = [];
    const matchedIndices: number[] = [];

    let allRequired = true;
    for (const required of pattern.required) {
      const idx = findingDescriptions.findIndex(
        (desc, i) => desc.includes(required) && !matchedIndices.includes(i)
      );

      if (idx >= 0) {
        matchedFindings.push(findings[idx]);
        matchedIndices.push(idx);
      } else {
        allRequired = false;
        break;
      }
    }

    if (!allRequired) continue;

    // Chain detected! Build the chain object
    const steps: ChainStep[] = matchedFindings.map((finding, i) => ({
      order: i + 1,
      finding,
      role: pattern.roles[i] || `Step ${i + 1}`,
      transition: pattern.transitions[i] || "",
    }));

    // Check for optional enhancing findings
    for (const optional of pattern.optional) {
      const optIdx = findingDescriptions.findIndex(
        (desc, i) => desc.includes(optional) && !matchedIndices.includes(i)
      );
      if (optIdx >= 0) {
        steps.push({
          order: steps.length + 1,
          finding: findings[optIdx],
          role: "Supporting evidence",
          transition: "Strengthens the attack chain",
        });
      }
    }

    chains.push({
      chain_id: `chain_${Date.now()}_${chains.length}`,
      name: pattern.name,
      description: pattern.description,
      steps,
      combined_impact: pattern.combined_impact,
      original_severities: matchedFindings.map((f) => f.severity),
      cvss_estimated: pattern.cvss_estimated,
      mitre_techniques: pattern.mitre_techniques,
      remediation: pattern.remediation,
    });
  }

  // Sort by impact (critical first)
  chains.sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return (order[a.combined_impact] || 4) - (order[b.combined_impact] || 4);
  });

  if (chains.length > 0) {
    console.log(`[Chainer] Detected ${chains.length} attack chains:`);
    for (const chain of chains) {
      console.log(`  🔗 ${chain.name} [${chain.combined_impact.toUpperCase()}] (CVSS: ${chain.cvss_estimated})`);
      console.log(`     Original severities: ${chain.original_severities.join(" + ")} → ${chain.combined_impact}`);
    }
  }

  return chains;
}

/**
 * Calculate the combined CVSS score for a chain of findings.
 * Uses the maximum individual CVSS as a base and adjusts upward
 * based on the chain complexity and combined impact.
 */
export function calculateChainedCVSS(findings: Finding[]): number {
  if (findings.length === 0) return 0;

  const maxCVSS = Math.max(...findings.map((f) => f.cvss_score));
  const chainBonus = Math.min(findings.length * 0.5, 2.0); // Up to +2.0 for chain complexity
  
  return Math.min(maxCVSS + chainBonus, 10.0); // Cap at 10.0
}

/**
 * Generate a human-readable chain description for reports.
 */
export function formatChainReport(chain: AttackChain): string {
  const lines: string[] = [
    `## 🔗 Attack Chain: ${chain.name}`,
    `**Impact:** ${chain.combined_impact.toUpperCase()} (CVSS: ${chain.cvss_estimated})`,
    `**MITRE ATT&CK:** ${chain.mitre_techniques.join(", ")}`,
    "",
    `### Description`,
    chain.description,
    "",
    `### Attack Steps`,
  ];

  for (const step of chain.steps) {
    lines.push(`**Step ${step.order}:** ${step.role}`);
    lines.push(`- Finding: ${step.finding.description}`);
    lines.push(`- Original Severity: ${step.finding.severity}`);
    if (step.transition) {
      lines.push(`- → ${step.transition}`);
    }
    lines.push("");
  }

  lines.push(`### Remediation`);
  lines.push(chain.remediation);

  return lines.join("\n");
}
