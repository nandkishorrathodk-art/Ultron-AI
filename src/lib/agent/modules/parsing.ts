/**
 * ULTRON v3.0 — Output Parsing Module
 * Parses tool/command output to extract structured findings.
 */

import type { Finding } from "../flow";

const CVE_REGEX = /CVE-\d{4}-\d{4,}/gi;
const PORT_REGEX = /(\d{1,5})\/tcp\s+open\s+(\S+)/g;

export function parseOutput(command: string, stdout: string): Finding[] {
  const findings: Finding[] = [];

  // Extract open ports from nmap-style output
  for (const match of stdout.matchAll(PORT_REGEX)) {
    findings.push({
      type: "open_port",
      severity: "info",
      description: `Port ${match[1]}/tcp open — service: ${match[2]}`,
      raw_output: match[0],
      cve_ids: [],
      cvss_score: 0,
      epss_score: 0,
      remediation: "Review if this port/service should be exposed",
      evidence: match[0],
      mitre_technique: null,
    });
  }

  // Extract CVEs mentioned in output
  const cves = stdout.match(CVE_REGEX);
  if (cves) {
    findings.push({
      type: "vulnerability",
      severity: "high",
      description: `CVEs detected in output of: ${command}`,
      raw_output: stdout.slice(0, 500),
      cve_ids: [...new Set(cves)],
      cvss_score: 0,
      epss_score: 0,
      remediation: "Research and patch identified CVEs",
      evidence: cves.join(", "),
      mitre_technique: null,
    });
  }

  // Detect VULNERABLE markers
  if (/VULNERABLE|VULN/i.test(stdout)) {
    findings.push({
      type: "vulnerability",
      severity: "high",
      description: `Vulnerability confirmed by: ${command}`,
      raw_output: stdout.slice(0, 500),
      cve_ids: cves ? [...new Set(cves)] : [],
      cvss_score: 0,
      epss_score: 0,
      remediation: "Investigate and remediate the vulnerability",
      evidence: stdout
        .split("\n")
        .filter((l) => /VULNERABLE|VULN/i.test(l))
        .join("\n"),
      mitre_technique: null,
    });
  }

  return findings;
}
