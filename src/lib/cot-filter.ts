/**
 * ULTRON v3.0 — Preference-Based Chain-of-Thought Output Filter
 * Based on PTFusion 2026 research.
 *
 * Strips redundant/noisy tool output BEFORE passing to LLM.
 * Extracts structured entities and keeps only high-signal lines.
 * Reduces hallucination from long stdout outputs.
 */

interface ExtractedEntities {
  ips: string[];
  ports: string[];
  services: string[];
  cves: string[];
  domains: string[];
}

const IP_REGEX = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const PORT_REGEX = /\b(\d{1,5})\/(?:tcp|udp)\b/g;
const CVE_REGEX = /CVE-\d{4}-\d{4,}/gi;
const DOMAIN_REGEX = /\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}\b/gi;
const SERVICE_REGEX = /(?:open|filtered)\s+(\S+)/g;

function extractEntities(rawOutput: string): ExtractedEntities {
  const ips = [...new Set(rawOutput.match(IP_REGEX) ?? [])];
  const ports = [...new Set([...rawOutput.matchAll(PORT_REGEX)].map((m) => m[0]))];
  const cves = [...new Set(rawOutput.match(CVE_REGEX) ?? [])];
  const domains = [...new Set(rawOutput.match(DOMAIN_REGEX) ?? [])].slice(0, 20);
  const services = [...new Set([...rawOutput.matchAll(SERVICE_REGEX)].map((m) => m[1]))];

  return { ips, ports, services, cves, domains };
}

const HIGH_SIGNAL_PATTERNS = [
  /\bopen\b/i,
  /\bCVE-/i,
  /\bVULNERABLE\b/i,
  /\[\+\]/,
  /\[\*\]/,
  /\[!\]/,
  /\d+\/tcp\s+open/,
  /\d+\/udp\s+open/,
  /\bfound\b/i,
  /\bcritical\b/i,
  /\bhigh\b/i,
  /\bexploit\b/i,
  /\bshell\b/i,
  /\broot\b/i,
  /\bpassword\b/i,
  /\bcredential/i,
  /\btoken\b/i,
  /\berror\b/i,
  /\bdenied\b/i,
  /\bfailed\b/i,
  /\bwarning\b/i,
  /^\s*\|/,
  /^\s*\+--/,
];

/**
 * Filter raw tool output using Preference-Based CoT methodology.
 * Returns structured summary for the LLM.
 */
export function filterToolOutput(toolName: string, rawOutput: string): string {
  if (!rawOutput || rawOutput.length < 100) return rawOutput;

  const lines = rawOutput.split("\n");

  // For short output, return as-is
  if (lines.length <= 50) return rawOutput;

  const entities = extractEntities(rawOutput);

  const highSignal = lines
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      return HIGH_SIGNAL_PATTERNS.some((pattern) => pattern.test(trimmed));
    })
    .slice(0, 50);

  // If very few high-signal lines, include first/last lines for context
  if (highSignal.length < 5) {
    const head = lines.slice(0, 10);
    const tail = lines.slice(-5);
    return [
      ...head,
      `\n... (${lines.length - 15} lines filtered) ...\n`,
      ...tail,
    ].join("\n");
  }

  const entitySummary = [];
  if (entities.ips.length > 0) entitySummary.push(`IPs: ${entities.ips.join(", ")}`);
  if (entities.ports.length > 0) entitySummary.push(`Ports: ${entities.ports.join(", ")}`);
  if (entities.services.length > 0) entitySummary.push(`Services: ${entities.services.join(", ")}`);
  if (entities.cves.length > 0) entitySummary.push(`CVEs: ${entities.cves.join(", ")}`);
  if (entities.domains.length > 0) entitySummary.push(`Domains: ${entities.domains.slice(0, 10).join(", ")}`);

  return [
    `TOOL: ${toolName}`,
    entitySummary.length > 0 ? `ENTITIES: ${entitySummary.join(" | ")}` : "",
    `KEY FINDINGS (${highSignal.length} of ${lines.length} lines):`,
    highSignal.join("\n"),
  ]
    .filter(Boolean)
    .join("\n");
}
