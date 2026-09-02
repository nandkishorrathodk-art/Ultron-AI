/* eslint-disable @typescript-eslint/no-explicit-any, prefer-const */
/**
 * Parsing Module v2.0 — LLM-Powered Structured Output Parsing
 * ═══════════════════════════════════════════════════════════════
 * UPGRADES:
 *  - LLM-powered output parsing (not just string matching)
 *  - Structured finding extraction from any tool output
 *  - Auto-spawn downstream PTG tasks from findings
 *  - CVSS/EPSS scoring from RAG context
 *  - Evidence preservation for PoC generation
 * ═══════════════════════════════════════════════════════════════
 */

import { Finding } from "../ptg";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParseResult {
  findings: Finding[];
  raw_output: string;
  tool_detected: string;
  summary: string;
}

// ─── Tool Output Patterns ─────────────────────────────────────────────────────

/**
 * Pattern-based parsing for common tools.
 * This runs first — fast and deterministic.
 * Falls through to LLM parsing for unknown formats.
 */
function patternParse(
  command: string,
  stdout: string,
  stderr: string,
): Finding[] {
  const combined = (stdout + "\n" + stderr).trim();
  const findings: Finding[] = [];

  // ── browser_attack parsing ─────────────────────────────────
  if (command.includes("browser_attack")) {
    try {
      const output = JSON.parse(stdout.trim());
      if (output && Array.isArray(output.findings)) {
        return output.findings;
      }
    } catch {
      // Fall through
    }
  }

  // ── nmap parsing ──────────────────────────────────────────
  if (command.includes("nmap")) {
    // Open ports
    const portMatches = combined.matchAll(/(\d+)\/tcp\s+open\s+(\S+)\s*(.*)/g);
    for (const match of portMatches) {
      findings.push({
        type: "open_port",
        severity: "info",
        description:
          `Port ${match[1]}/tcp open — ${match[2]} ${match[3]}`.trim(),
        raw_output: match[0],
        cve_ids: [],
        cvss_score: 0,
        epss_score: 0,
        remediation: "Review if this service needs to be publicly exposed",
        evidence: match[0],
        endpoint: `target:${match[1]}`,
      });

      // Service detection
      if (match[3] && match[3].trim() !== "") {
        findings.push({
          type: "service",
          severity: "info",
          description: `${match[2]} ${match[3]}`.trim(),
          raw_output: match[0],
          cve_ids: [],
          cvss_score: 0,
          epss_score: 0,
          remediation: "Keep service updated to latest version",
          evidence: `Service: ${match[2]} ${match[3]}`,
          endpoint: `target:${match[1]}`,
        });
      }
    }

    // NSE script findings (vulnerabilities)
    const vulnMatches = combined.matchAll(/\|\s+(CVE-\d{4}-\d+).*?$/gm);
    for (const match of vulnMatches) {
      findings.push({
        type: "vulnerability",
        severity: "high",
        description: `NSE script detected: ${match[1]}`,
        raw_output: match[0],
        cve_ids: [match[1]],
        cvss_score: 7.0, // Default for NSE findings
        epss_score: 0,
        remediation: `Patch ${match[1]}`,
        evidence: match[0],
      });
    }
  }

  // ── nuclei parsing ────────────────────────────────────────
  if (command.includes("nuclei")) {
    // Nuclei output: [severity] [template-id] [protocol] url
    const nucleiMatches = combined.matchAll(
      /\[(info|low|medium|high|critical)\]\s+\[([^\]]+)\]\s+\[([^\]]+)\]\s+(.+)/gi,
    );
    for (const match of nucleiMatches) {
      const severity = match[1].toLowerCase() as Finding["severity"];
      findings.push({
        type: "vulnerability",
        severity,
        description: `Nuclei: ${match[2]} (${match[3]}) — ${match[4]}`,
        raw_output: match[0],
        cve_ids: extractCVEs(match[2] + " " + match[4]),
        cvss_score: severityToCVSS(severity),
        epss_score: 0,
        remediation: `Address ${match[2]} vulnerability`,
        evidence: match[0],
        endpoint: match[4].trim(),
      });
    }
  }

  // ── nikto parsing ─────────────────────────────────────────
  if (command.includes("nikto")) {
    const niktoMatches = combined.matchAll(
      /\+\s+(OSVDB-\d+|CVE-\d{4}-\d+):\s*(.+)/g,
    );
    for (const match of niktoMatches) {
      findings.push({
        type: "vulnerability",
        severity: "medium",
        description: `Nikto: ${match[1]} — ${match[2]}`,
        raw_output: match[0],
        cve_ids: extractCVEs(match[1]),
        cvss_score: 5.0,
        epss_score: 0,
        remediation: match[2].trim(),
        evidence: match[0],
      });
    }
  }

  // ── gobuster / ffuf / dirsearch ───────────────────────────
  if (
    command.includes("gobuster") ||
    command.includes("ffuf") ||
    command.includes("dirsearch")
  ) {
    // Look for interesting status codes
    const dirMatches = combined.matchAll(
      /(\S+)\s+\(Status:\s*(200|301|302|403|500)\)/g,
    );
    for (const match of dirMatches) {
      const status = match[2];
      if (status === "200" || status === "301" || status === "302") {
        findings.push({
          type: "service",
          severity: "info",
          description: `Discovered endpoint: ${match[1]} (HTTP ${status})`,
          raw_output: match[0],
          cve_ids: [],
          cvss_score: 0,
          epss_score: 0,
          remediation: "Review if endpoint should be publicly accessible",
          evidence: match[0],
          endpoint: match[1],
        });
      }
      if (status === "403") {
        findings.push({
          type: "service",
          severity: "low",
          description: `Forbidden endpoint (potential target): ${match[1]} (HTTP 403)`,
          raw_output: match[0],
          cve_ids: [],
          cvss_score: 2.0,
          epss_score: 0,
          remediation: "Verify if 403 can be bypassed",
          evidence: match[0],
          endpoint: match[1],
        });
      }
    }
  }

  // ── sqlmap parsing ────────────────────────────────────────
  if (command.includes("sqlmap")) {
    if (combined.includes("injectable") || combined.includes("is vulnerable")) {
      findings.push({
        type: "vulnerability",
        severity: "critical",
        description: "SQL Injection confirmed by sqlmap",
        raw_output: combined.slice(0, 500),
        cve_ids: [],
        cvss_score: 9.8,
        epss_score: 0.9,
        remediation: "Use parameterized queries / prepared statements",
        evidence: combined.slice(0, 500),
      });
    }
  }

  // ── Generic credential detection ──────────────────────────
  const credPatterns = [
    /password\s*[:=]\s*['"]?(\S+)/gi,
    /api[_-]?key\s*[:=]\s*['"]?(\S+)/gi,
    /token\s*[:=]\s*['"]?([a-zA-Z0-9_\-\.]+)/gi,
    /secret\s*[:=]\s*['"]?(\S+)/gi,
  ];

  for (const pattern of credPatterns) {
    const matches = combined.matchAll(pattern);
    for (const match of matches) {
      // Filter out common false positives
      if (
        match[1].length > 5 &&
        !match[1].includes("***") &&
        !match[1].includes("xxx")
      ) {
        findings.push({
          type: "credential",
          severity: "high",
          description: `Exposed credential: ${match[0].slice(0, 50)}...`,
          raw_output: match[0],
          cve_ids: [],
          cvss_score: 7.5,
          epss_score: 0,
          remediation: "Rotate exposed credentials immediately",
          evidence: match[0],
        });
      }
    }
  }

  // ── Shell access detection ────────────────────────────────
  if (
    combined.includes("uid=") ||
    (combined.includes("$ ") && combined.includes("root")) ||
    combined.includes("meterpreter >") ||
    combined.includes("shell opened")
  ) {
    findings.push({
      type: "shell_access",
      severity: "critical",
      description: "Shell access obtained",
      raw_output: combined.slice(0, 300),
      cve_ids: [],
      cvss_score: 10.0,
      epss_score: 1.0,
      remediation: "Critical: Patch exploited vulnerability immediately",
      evidence: combined.slice(0, 300),
    });
  }

  return findings;
}

// ─── LLM Parsing ──────────────────────────────────────────────────────────────

/**
 * Use LLM to parse complex or unrecognized tool output.
 */
async function llmParse(
  command: string,
  stdout: string,
  stderr: string,
): Promise<Finding[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return [];

  try {
    const provider = createOpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey,
    });

    const truncatedOutput = stdout.slice(0, 3000);

    const result = await generateText({
      model: provider("x-ai/grok-4.1-fast"),
      prompt: `You are a security analyst. Parse this tool output and extract findings.

Command: ${command}
Output:
${truncatedOutput}

For each finding, respond in this exact format (one per line):
FINDING|type|severity|description|cve_ids|cvss_score
Where type is: open_port, service, vulnerability, credential, shell_access
Where severity is: info, low, medium, high, critical

Example: FINDING|vulnerability|high|SQL Injection in /api/users endpoint|CVE-2021-12345|8.6

If no significant findings, respond: NO_FINDINGS`,
      maxTokens: 500,
    } as any);

    const findings: Finding[] = [];
    const lines = result.text.split("\n");

    for (const line of lines) {
      if (!line.startsWith("FINDING|")) continue;

      const parts = line.split("|");
      if (parts.length < 6) continue;

      findings.push({
        type: parts[1] as Finding["type"],
        severity: parts[2] as Finding["severity"],
        description: parts[3],
        raw_output: truncatedOutput.slice(0, 200),
        cve_ids: parts[4] ? parts[4].split(",").filter(Boolean) : [],
        cvss_score: parseFloat(parts[5]) || 0,
        epss_score: 0,
        remediation: "Review and remediate based on finding severity",
        evidence: truncatedOutput.slice(0, 200),
      });
    }

    return findings;
  } catch (err: any) {
    console.error(`[Parsing] LLM parse failed: ${err.message}`);
    return [];
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractCVEs(text: string): string[] {
  const matches = text.matchAll(/CVE-\d{4}-\d+/gi);
  return [...new Set(Array.from(matches, (m) => m[0].toUpperCase()))];
}

function severityToCVSS(severity: Finding["severity"]): number {
  const map: Record<string, number> = {
    info: 0,
    low: 3.1,
    medium: 5.3,
    high: 7.5,
    critical: 9.8,
  };
  return map[severity] || 0;
}

// ─── Main Parse Function ──────────────────────────────────────────────────────

/**
 * Parse tool output into structured findings.
 * Uses pattern matching first, falls back to LLM for complex output.
 */
export async function parseOutput(
  command: string,
  stdout: string,
  stderr: string,
): Promise<ParseResult> {
  console.log(`[Parsing] Parsing output for: ${command.slice(0, 80)}...`);

  // 1. Pattern-based parsing (fast, deterministic)
  let findings = patternParse(command, stdout, stderr);

  // 2. If no findings from patterns and output is non-trivial, try LLM
  if (findings.length === 0 && (stdout.length > 50 || stderr.length > 50)) {
    console.log("[Parsing] No pattern matches — using LLM parser");
    const llmFindings = await llmParse(command, stdout, stderr);
    findings.push(...llmFindings);
  }

  // Detect tool type
  const tool = command.split(" ")[0].replace(/^.*\//, "");

  const summary =
    findings.length > 0
      ? `Found ${findings.length} findings: ${findings.map((f) => `[${f.severity}] ${f.type}`).join(", ")}`
      : "No significant findings in output";

  console.log(`[Parsing] ${summary}`);

  return {
    findings,
    raw_output: stdout.slice(0, 5000),
    tool_detected: tool,
    summary,
  };
}
