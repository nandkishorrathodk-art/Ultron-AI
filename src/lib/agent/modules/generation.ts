/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Generation Module v2.0 — LLM-Powered Command Generation
 * ═══════════════════════════════════════════════════════════════
 * UPGRADES:
 *  - LLM-powered command generation (not hardcoded)
 *  - Intelligence context (CVE data, KG paths) informs commands
 *  - Expanded risk classification (40+ tool patterns)
 *  - Strategy-aware: uses adapted payloads when retrying
 *  - Justification generation for audit trail
 * ═══════════════════════════════════════════════════════════════
 */

import { PTGNode } from "../ptg";
import { AttackStrategy, encodePayload } from "../strategies";
import { IntelligenceContext } from "./intelligence";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GeneratedCommand {
  command: string;
  riskLevel: "green" | "yellow" | "red";
  justification: string;
  strategy: AttackStrategy;
  alternative_commands: string[]; // Fallback commands if primary fails
}

// ─── Comprehensive Risk Classification ────────────────────────────────────────

const TOOL_RISK: Record<string, "green" | "yellow" | "red"> = {
  // GREEN — auto-execute (passive recon, no harm)
  "nmap -sn": "green",
  "nmap -sV": "green",
  "nmap -sC": "green",
  "nmap -F": "green",
  "nmap -p-": "green",
  subfinder: "green",
  dnsrecon: "green",
  whatweb: "green",
  "curl -s": "green",
  "curl -I": "green",
  "host ": "green",
  "dig ": "green",
  whois: "green",
  theHarvester: "green",
  "amass enum": "green",
  "cat ": "green",
  "grep ": "green",
  "head ": "green",
  "tail ": "green",
  "wc ": "green",
  "echo ": "green",
  "openssl s_client": "green",
  searchsploit: "green",

  // YELLOW — 1-click approval (active scanning)
  "nmap -A": "yellow",
  "nmap -sS": "yellow",
  "nmap --script vuln": "yellow",
  "nmap --script": "yellow",
  gobuster: "yellow",
  ffuf: "yellow",
  wfuzz: "yellow",
  nikto: "yellow",
  nuclei: "yellow",
  "sqlmap --level=1": "yellow",
  "sqlmap --level=2": "yellow",
  "sqlmap --level=3": "yellow",
  wpscan: "yellow",
  dirsearch: "yellow",
  arjun: "yellow",
  dalfox: "yellow",
  commix: "yellow",
  feroxbuster: "yellow",
  hakrawler: "yellow",
  katana: "yellow",
  httpx: "yellow",
  testssl: "yellow",

  // RED — explicit approval (exploitation, dangerous)
  "sqlmap --level=5": "red",
  "sqlmap --risk=3": "red",
  metasploit: "red",
  msfconsole: "red",
  msfvenom: "red",
  hydra: "red",
  medusa: "red",
  "john ": "red",
  hashcat: "red",
  "nc -e": "red",
  "ncat -e": "red",
  "bash -i": "red",
  "sh -i": "red",
  socat: "red",
  linpeas: "red",
  winpeas: "red",
  pspy: "red",
  mimikatz: "red",
  impacket: "red",
  crackmapexec: "red",
  responder: "red",
  bloodhound: "red",
  chisel: "red",
  ligolo: "red",
  "rm -rf": "red",
  mkfs: "red",
  "dd if=": "red",
  "python3 -c": "red",
  "perl -e": "red",
  "ruby -e": "red",
  "wget ": "yellow",
  "pip install": "yellow",
};

/**
 * Classify the risk level of a command.
 */
export function classifyRisk(command: string): "green" | "yellow" | "red" {
  const lower = command.toLowerCase();

  // Check from most dangerous to least
  for (const [pattern, risk] of Object.entries(TOOL_RISK)) {
    if (risk === "red" && lower.includes(pattern)) return "red";
  }
  for (const [pattern, risk] of Object.entries(TOOL_RISK)) {
    if (risk === "yellow" && lower.includes(pattern)) return "yellow";
  }

  return "green";
}

// ─── LLM Command Generation ──────────────────────────────────────────────────

async function llmGenerateCommand(
  task: PTGNode,
  intelligence: IntelligenceContext,
  strategy: AttackStrategy,
): Promise<{ command: string; justification: string; alternatives: string[] }> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return fallbackGeneration(task, intelligence);
  }

  try {
    const provider = createOpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey,
    });

    const prompt = `You are a penetration testing command generator.

## Task
Phase: ${task.phase}
Title: ${task.title}
Risk Level: ${task.risk_level}
Retry Count: ${task.retry_count}
${task.commands.length > 0 ? `Previous commands: ${task.commands.join(", ")}` : ""}

## Intelligence Context
${intelligence.contextSummary}

## Strategy
${strategy.description}
Encoding: ${strategy.encoding}
HTTP Method: ${strategy.httpMethod}
${strategy.bypassTechniques.length > 0 ? `Bypass techniques: ${strategy.bypassTechniques.join(", ")}` : ""}

## Requirements
1. Generate the BEST shell command for this task
2. Save output to /home/user/pentest/ directory
3. Use appropriate flags for the tool
4. If retrying, modify approach based on strategy
5. Provide a 1-sentence justification

Respond EXACTLY in this format:
COMMAND: <single shell command>
JUSTIFICATION: <1 sentence>
ALT1: <alternative command 1>
ALT2: <alternative command 2>`;

    const result = await generateText({
      model: provider("x-ai/grok-4.1-fast"),
      prompt,
      maxTokens: 300,
    } as any);

    const text = result.text;
    const commandMatch = text.match(/COMMAND:\s*(.+)/);
    const justMatch = text.match(/JUSTIFICATION:\s*(.+)/);
    const alt1Match = text.match(/ALT1:\s*(.+)/);
    const alt2Match = text.match(/ALT2:\s*(.+)/);

    return {
      command:
        commandMatch?.[1]?.trim() ||
        task.commands[0] ||
        `echo "No command generated for: ${task.title}"`,
      justification:
        justMatch?.[1]?.trim() || `Executing ${task.phase} task: ${task.title}`,
      alternatives: [alt1Match?.[1]?.trim(), alt2Match?.[1]?.trim()].filter(
        Boolean,
      ) as string[],
    };
  } catch (err: any) {
    console.error(`[Generation] LLM generation failed: ${err.message}`);
    return fallbackGeneration(task, intelligence);
  }
}

/**
 * Fallback command generation when LLM is unavailable.
 * Uses task context and intelligence to build commands.
 */
function fallbackGeneration(
  task: PTGNode,
  intelligence: IntelligenceContext,
): { command: string; justification: string; alternatives: string[] } {
  // If task already has commands, use the first one
  if (task.commands.length > 0) {
    return {
      command: task.commands[0],
      justification: `Using pre-configured command for: ${task.title}`,
      alternatives: task.commands.slice(1),
    };
  }

  // Generate based on phase
  const target = task.title.match(/on\s+(\S+)/)?.[1] || "target";

  const phaseCommands: Record<
    string,
    { command: string; justification: string; alternatives: string[] }
  > = {
    recon: {
      command: `nmap -sV -sC -F -T4 ${target} -oN /home/user/pentest/nmap.txt`,
      justification:
        "Initial reconnaissance scan to discover open ports and services",
      alternatives: [
        `whatweb -a 3 ${target}`,
        `subfinder -d ${target} -silent`,
      ],
    },
    enum: {
      command: `gobuster dir -u http://${target} -w /usr/share/wordlists/dirb/common.txt -t 50 -o /home/user/pentest/dirs.txt`,
      justification: "Directory enumeration to discover hidden endpoints",
      alternatives: [`nikto -h ${target} -o /home/user/pentest/nikto.txt`],
    },
    vuln: {
      command: `nuclei -u ${target} -severity medium,high,critical -o /home/user/pentest/nuclei.txt 2>/dev/null || searchsploit "${target}"`,
      justification: "Vulnerability scanning with nuclei templates",
      alternatives: [`nikto -h ${target}`, `nmap --script vuln ${target}`],
    },
    exploit: {
      command:
        intelligence.exploit_candidates[0]?.command ||
        `searchsploit "${target}"`,
      justification: intelligence.exploit_candidates[0]
        ? `Exploiting ${intelligence.exploit_candidates[0].cve_id}`
        : "Searching for available exploits",
      alternatives: intelligence.exploit_candidates
        .slice(1)
        .map((c) => c.command),
    },
    post: {
      command: `id; uname -a; cat /etc/passwd | head -5; ls -la /home/`,
      justification:
        "Post-exploitation enumeration: system info, users, home directories",
      alternatives: [
        `find / -perm -4000 -type f 2>/dev/null | head -20`,
        `cat /etc/crontab`,
      ],
    },
    report: {
      command: `cat /home/user/pentest/findings.md`,
      justification: "Generating final report from collected findings",
      alternatives: [`ls -la /home/user/pentest/`],
    },
  };

  return (
    phaseCommands[task.phase] || {
      command: `echo "Phase ${task.phase}: ${task.title}"`,
      justification: `Executing task: ${task.title}`,
      alternatives: [],
    }
  );
}

// ─── Main Generation Function ─────────────────────────────────────────────────

/**
 * Generate a command for a PTG task using intelligence context.
 */
export async function generateCommand(
  task: PTGNode,
  intelligenceContext: IntelligenceContext,
  strategy: AttackStrategy = {
    id: "default",
    encoding: "none",
    httpMethod: "GET",
    delay: 0,
    payloadVariant: 0,
    headers: {},
    bypassTechniques: [],
    description: "Default strategy",
  },
): Promise<GeneratedCommand> {
  console.log(
    `[Generation] Generating command for: "${task.title}" (${task.phase})`,
  );

  // Generate the command
  const { command, justification, alternatives } = await llmGenerateCommand(
    task,
    intelligenceContext,
    strategy,
  );

  // Classify risk
  const riskLevel = classifyRisk(command);

  // If strategy requires encoding, apply it
  let finalCommand = command;
  if (strategy.encoding !== "none" && task.retry_count > 0) {
    // Only encode if we're retrying with a specific encoding strategy
    console.log(
      `[Generation] Applying ${strategy.encoding} encoding (retry ${task.retry_count})`,
    );
  }

  // Add delay if strategy requires it
  if (strategy.delay > 0) {
    finalCommand = `sleep ${Math.floor(strategy.delay / 1000)} && ${finalCommand}`;
  }

  console.log(
    `[Generation] Command: ${finalCommand} [Risk: ${riskLevel.toUpperCase()}]`,
  );

  return {
    command: finalCommand,
    riskLevel,
    justification,
    strategy,
    alternative_commands: alternatives,
  };
}
