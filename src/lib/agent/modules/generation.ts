/**
 * ULTRON v3.0 — Command Generation Module
 * Generates the next command for a given task based on intelligence context.
 */

import type { FlowTask, RiskLevel } from "../flow";

const TOOL_RISK: Record<string, RiskLevel> = {
  nmap: "yellow",
  nikto: "yellow",
  nuclei: "yellow",
  sqlmap: "red",
  metasploit: "red",
  hydra: "red",
  gobuster: "yellow",
  ffuf: "yellow",
  subfinder: "green",
  dnsrecon: "green",
  whatweb: "green",
  curl: "green",
  wget: "green",
  searchsploit: "green",
};

interface IntelligenceContext {
  cveRecommendations: string[];
  mitreTechniques: string[];
  kgPaths: string[];
}

interface GeneratedCommand {
  command: string;
  riskLevel: RiskLevel;
}

export function generateCommand(
  task: FlowTask,
  _context: IntelligenceContext,
): GeneratedCommand {
  // For now, return the first command from the task if available
  if (task.commands.length > 0) {
    const cmd = task.commands[0];
    const tool = cmd.split(" ")[0].toLowerCase();
    return {
      command: cmd,
      riskLevel: TOOL_RISK[tool] ?? "green",
    };
  }

  // Default fallback
  return {
    command: "echo 'No command specified for this task'",
    riskLevel: "green",
  };
}
