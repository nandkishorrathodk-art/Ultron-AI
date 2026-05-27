/**
 * PTG Task Templates — Pre-built Attack Plans
 * ═══════════════════════════════════════════════════════════════
 * Each attack mode has a pre-built directed task graph that
 * the Coordinator instantiates when a session begins.
 *
 * Standard Mode: Full recon → enum → vuln → exploit → report
 * CTF Mode:      Flag-focused with web/binary/crypto branches
 * Bug Bounty:    Scope-enforced with evidence collection
 * Continuous:    Delta-based with baseline comparison
 * ═══════════════════════════════════════════════════════════════
 */

import { PTGNode, Finding } from "./ptg";

// ─── Helpers ──────────────────────────────────────────────────────────────────

let nodeCounter = 0;

function createNode(
  overrides: Partial<PTGNode> & { phase: PTGNode["phase"]; title: string }
): PTGNode {
  nodeCounter++;
  const { phase, title, ...rest } = overrides;
  return {
    task_id: `task_${Date.now()}_${nodeCounter}`,
    parent_ids: [],
    child_ids: [],
    phase,
    title,
    status: "pending",
    risk_level: overrides.risk_level || "green",
    priority: overrides.priority || 3,
    assigned_agent: null,
    commands: overrides.commands || [],
    findings: [],
    cvss_score: null,
    epss_score: null,
    mitre_technique: overrides.mitre_technique || null,
    retry_count: 0,
    max_retries: overrides.max_retries || 3,
    created_at: Date.now(),
    started_at: null,
    completed_at: null,
    hitl_approval: {
      required: overrides.risk_level === "red",
      approved_by: null,
      approved_at: null,
      denied_at: null,
      timeout_at: Date.now() + 300000,
    },
    ...rest,
  };
}

function link(parent: PTGNode, child: PTGNode): void {
  child.parent_ids.push(parent.task_id);
  parent.child_ids.push(child.task_id);
}

// ─── Standard Mode Template ───────────────────────────────────────────────────

export function buildStandardTemplate(target: string): PTGNode[] {
  const nodes: PTGNode[] = [];

  // Phase 1: Recon (all parallel)
  const subdomain = createNode({
    phase: "recon",
    title: `Subdomain enumeration on ${target}`,
    priority: 1,
    commands: [`subfinder -d ${target} -silent -o /home/user/pentest/subdomains.txt`],
    mitre_technique: "T1595.002",
  });

  const portScan = createNode({
    phase: "recon",
    title: `Port scan on ${target}`,
    priority: 1,
    commands: [`nmap -sV -sC -F -T4 ${target} -oN /home/user/pentest/nmap.txt`],
    mitre_technique: "T1046",
  });

  const techFingerprint = createNode({
    phase: "recon",
    title: `Technology fingerprinting on ${target}`,
    priority: 1,
    commands: [`whatweb -a 3 ${target} | tee /home/user/pentest/whatweb.txt`],
    mitre_technique: "T1592",
  });

  const dnsRecon = createNode({
    phase: "recon",
    title: `DNS reconnaissance on ${target}`,
    priority: 2,
    commands: [`dnsrecon -d ${target} -t std 2>/dev/null | tee /home/user/pentest/dns.txt`],
    mitre_technique: "T1590.002",
  });

  // Phase 2: Enumeration (depends on recon)
  const dirEnum = createNode({
    phase: "enum",
    title: `Directory enumeration on ${target}`,
    priority: 2,
    risk_level: "yellow",
    commands: [
      `gobuster dir -u https://${target} -w /usr/share/wordlists/dirb/common.txt -t 50 -o /home/user/pentest/dirs.txt 2>/dev/null || gobuster dir -u http://${target} -w /usr/share/wordlists/dirb/common.txt -t 50 -o /home/user/pentest/dirs.txt`,
    ],
    mitre_technique: "T1083",
  });
  link(portScan, dirEnum);

  const serviceEnum = createNode({
    phase: "enum",
    title: `Service version enumeration on ${target}`,
    priority: 2,
    commands: [`nmap -sV -p- --min-rate=1000 ${target} -oN /home/user/pentest/nmap-full.txt`],
    mitre_technique: "T1046",
  });
  link(portScan, serviceEnum);

  const sslCheck = createNode({
    phase: "enum",
    title: `SSL/TLS configuration check on ${target}`,
    priority: 3,
    commands: [`echo | openssl s_client -connect ${target}:443 2>/dev/null | openssl x509 -noout -dates -subject -issuer | tee /home/user/pentest/ssl.txt`],
    mitre_technique: "T1590",
  });
  link(portScan, sslCheck);

  // Phase 3: Vulnerability Assessment (depends on enumeration)
  const nucleiScan = createNode({
    phase: "vuln",
    title: `Nuclei vulnerability scan on ${target}`,
    priority: 1,
    risk_level: "yellow",
    commands: [`nuclei -u ${target} -severity medium,high,critical -o /home/user/pentest/nuclei.txt 2>/dev/null || echo "nuclei not installed"`],
    mitre_technique: "T1595.002",
  });
  link(serviceEnum, nucleiScan);
  link(dirEnum, nucleiScan);

  const niktoScan = createNode({
    phase: "vuln",
    title: `Nikto web server scan on ${target}`,
    priority: 2,
    risk_level: "yellow",
    commands: [`nikto -h ${target} -o /home/user/pentest/nikto.txt 2>/dev/null || echo "nikto not installed"`],
    mitre_technique: "T1595.002",
  });
  link(serviceEnum, niktoScan);

  const cveSearch = createNode({
    phase: "vuln",
    title: `CVE/Exploit search for services on ${target}`,
    priority: 1,
    commands: [], // Populated dynamically by Intelligence Module based on service versions
    mitre_technique: "T1588.005",
  });
  link(serviceEnum, cveSearch);

  // Phase 4: Exploitation (depends on vuln assessment — dynamically spawned)
  const exploitPlanning = createNode({
    phase: "exploit",
    title: `Exploitation planning based on findings for ${target}`,
    priority: 1,
    risk_level: "red",
    commands: [], // Populated by Generation Module
    mitre_technique: "T1190",
  });
  link(nucleiScan, exploitPlanning);
  link(niktoScan, exploitPlanning);
  link(cveSearch, exploitPlanning);

  // Phase 5: Post-Exploitation (depends on successful exploit)
  const postExploit = createNode({
    phase: "post",
    title: `Post-exploitation on ${target}`,
    priority: 2,
    risk_level: "red",
    commands: [], // Populated based on exploit results
    mitre_technique: "T1059",
  });
  link(exploitPlanning, postExploit);

  // Phase 6: Reporting (depends on everything)
  const report = createNode({
    phase: "report",
    title: `Generate pentest report for ${target}`,
    priority: 5,
    commands: [],
    mitre_technique: null,
  });
  link(nucleiScan, report);
  link(niktoScan, report);
  link(exploitPlanning, report);

  nodes.push(
    subdomain, portScan, techFingerprint, dnsRecon,
    dirEnum, serviceEnum, sslCheck,
    nucleiScan, niktoScan, cveSearch,
    exploitPlanning, postExploit, report
  );

  return nodes;
}

// ─── CTF Mode Template ────────────────────────────────────────────────────────

export function buildCTFTemplate(target: string): PTGNode[] {
  const nodes: PTGNode[] = [];

  const recon = createNode({
    phase: "recon",
    title: `CTF recon on ${target}`,
    priority: 1,
    commands: [`nmap -sV -sC -p- -T4 ${target} -oN /home/user/pentest/nmap.txt`],
  });

  // Web branch
  const webEnum = createNode({
    phase: "enum",
    title: `Web enumeration on ${target}`,
    priority: 1,
    commands: [
      `gobuster dir -u http://${target} -w /usr/share/wordlists/dirb/common.txt -t 50 -x php,txt,html,bak -o /home/user/pentest/dirs.txt`,
    ],
    risk_level: "yellow",
  });
  link(recon, webEnum);

  const webExploit = createNode({
    phase: "exploit",
    title: `Web exploitation on ${target}`,
    priority: 1,
    risk_level: "yellow",
    commands: [],
  });
  link(webEnum, webExploit);

  // Source code review
  const sourceReview = createNode({
    phase: "enum",
    title: `Source code review / robots.txt / .git / backup files`,
    priority: 2,
    commands: [
      `curl -s http://${target}/robots.txt; curl -s http://${target}/.git/HEAD; curl -s http://${target}/backup.zip -o /dev/null -w "%{http_code}"`,
    ],
  });
  link(recon, sourceReview);

  // Flag search
  const flagHunt = createNode({
    phase: "post",
    title: `Flag hunt — search for flag patterns`,
    priority: 1,
    commands: [], // Dynamically generated
  });
  link(webExploit, flagHunt);

  // Privesc
  const privesc = createNode({
    phase: "post",
    title: `Privilege escalation`,
    priority: 2,
    risk_level: "red",
    commands: [],
    mitre_technique: "T1068",
  });
  link(webExploit, privesc);

  const report = createNode({
    phase: "report",
    title: `CTF writeup generation`,
    priority: 5,
    commands: [],
  });
  link(flagHunt, report);

  nodes.push(recon, webEnum, webExploit, sourceReview, flagHunt, privesc, report);
  return nodes;
}

// ─── Bug Bounty Mode Template ─────────────────────────────────────────────────

export function buildBugBountyTemplate(target: string): PTGNode[] {
  const nodes: PTGNode[] = [];

  // Scope verification first
  const scopeCheck = createNode({
    phase: "recon",
    title: `Verify target ${target} is in-scope`,
    priority: 1,
    commands: [`echo "Scope check: ${target}"`],
  });

  const subdomain = createNode({
    phase: "recon",
    title: `Subdomain enumeration for ${target}`,
    priority: 1,
    commands: [
      `subfinder -d ${target} -silent -o /home/user/pentest/subdomains.txt`,
      `cat /home/user/pentest/subdomains.txt | wc -l`,
    ],
    mitre_technique: "T1595.002",
  });
  link(scopeCheck, subdomain);

  const portScan = createNode({
    phase: "recon",
    title: `Port scan on ${target}`,
    priority: 1,
    commands: [`nmap -sV -F -T4 ${target} -oN /home/user/pentest/nmap.txt`],
    mitre_technique: "T1046",
  });
  link(scopeCheck, portScan);

  // OWASP Top 10 checks (parallel)
  const owasp = [
    { name: "Injection (SQLi/CMDi)", technique: "T1190", risk: "yellow" as const },
    { name: "Broken Auth / IDOR", technique: "T1078", risk: "yellow" as const },
    { name: "XSS (Reflected/Stored/DOM)", technique: "T1059.007", risk: "yellow" as const },
    { name: "SSRF", technique: "T1090", risk: "yellow" as const },
    { name: "Security Misconfig", technique: "T1574", risk: "green" as const },
  ];

  const owaspNodes: PTGNode[] = owasp.map((item) => {
    const node = createNode({
      phase: "vuln",
      title: `OWASP check: ${item.name} on ${target}`,
      priority: 2,
      risk_level: item.risk,
      mitre_technique: item.technique,
      commands: [],
    });
    link(portScan, node);
    return node;
  });

  // Evidence collection for each finding
  const evidence = createNode({
    phase: "post",
    title: `Collect PoC evidence for validated findings`,
    priority: 3,
    commands: [],
  });
  owaspNodes.forEach((n) => link(n, evidence));

  // BB report
  const report = createNode({
    phase: "report",
    title: `Generate HackerOne/Bugcrowd report`,
    priority: 5,
    commands: [],
  });
  link(evidence, report);

  nodes.push(scopeCheck, subdomain, portScan, ...owaspNodes, evidence, report);
  return nodes;
}

// ─── Continuous Scan Template ─────────────────────────────────────────────────

export function buildContinuousTemplate(target: string): PTGNode[] {
  const nodes: PTGNode[] = [];

  const baseline = createNode({
    phase: "recon",
    title: `Baseline scan of ${target}`,
    priority: 1,
    commands: [
      `nmap -sV -F ${target} -oN /home/user/pentest/baseline.txt`,
      `subfinder -d ${target} -silent -o /home/user/pentest/baseline-subs.txt`,
    ],
  });

  const delta = createNode({
    phase: "enum",
    title: `Delta detection — compare current vs baseline`,
    priority: 1,
    commands: [],
  });
  link(baseline, delta);

  const newVulnCheck = createNode({
    phase: "vuln",
    title: `Check new CVEs against discovered services`,
    priority: 1,
    commands: [],
  });
  link(delta, newVulnCheck);

  const report = createNode({
    phase: "report",
    title: `Generate delta report`,
    priority: 5,
    commands: [],
  });
  link(newVulnCheck, report);

  nodes.push(baseline, delta, newVulnCheck, report);
  return nodes;
}

// ─── Template Factory ─────────────────────────────────────────────────────────

export function buildTemplate(
  target: string,
  mode: "standard" | "ctf" | "bug_bounty" | "continuous"
): PTGNode[] {
  // Reset counter for clean IDs
  nodeCounter = 0;

  switch (mode) {
    case "standard":
      return buildStandardTemplate(target);
    case "ctf":
      return buildCTFTemplate(target);
    case "bug_bounty":
      return buildBugBountyTemplate(target);
    case "continuous":
      return buildContinuousTemplate(target);
    default:
      return buildStandardTemplate(target);
  }
}

// ─── Dynamic Task Spawning ────────────────────────────────────────────────────

/**
 * Given a finding, generate downstream PTG tasks automatically.
 * This is the XBOW-style "auto-spawn" behavior.
 */
export function spawnTasksFromFinding(
  finding: Finding,
  parentTaskId: string,
  target: string
): PTGNode[] {
  const spawned: PTGNode[] = [];

  switch (finding.type) {
    case "open_port": {
      // Port found → spawn service enumeration
      const enumTask = createNode({
        phase: "enum",
        title: `Enumerate service on ${target} port (from finding)`,
        priority: 2,
        parent_ids: [parentTaskId],
        commands: [],
      });
      spawned.push(enumTask);
      break;
    }

    case "service": {
      // Service found → spawn CVE lookup + vuln scan
      const cveTask = createNode({
        phase: "vuln",
        title: `CVE lookup for ${finding.description}`,
        priority: 1,
        parent_ids: [parentTaskId],
        commands: [],
        mitre_technique: "T1588.005",
      });
      spawned.push(cveTask);
      break;
    }

    case "vulnerability": {
      // Vuln found → spawn exploit attempt + validation
      const exploitTask = createNode({
        phase: "exploit",
        title: `Exploit ${finding.cve_ids.join(", ") || finding.description}`,
        priority: 1,
        risk_level: finding.severity === "critical" || finding.severity === "high" ? "red" : "yellow",
        parent_ids: [parentTaskId],
        commands: [],
        mitre_technique: "T1190",
      });

      const validateTask = createNode({
        phase: "exploit",
        title: `Validate exploitability of ${finding.description}`,
        priority: 1,
        risk_level: "yellow",
        parent_ids: [parentTaskId],
        commands: [],
      });

      spawned.push(exploitTask, validateTask);
      break;
    }

    case "credential": {
      // Credential found → spawn lateral movement + privesc
      const lateralTask = createNode({
        phase: "post",
        title: `Lateral movement with found credentials`,
        priority: 1,
        risk_level: "red",
        parent_ids: [parentTaskId],
        commands: [],
        mitre_technique: "T1021",
      });
      spawned.push(lateralTask);
      break;
    }

    case "shell_access": {
      // Shell access → spawn post-exploitation
      const postExploitTasks = [
        createNode({
          phase: "post",
          title: `Privilege escalation check`,
          priority: 1,
          risk_level: "red",
          parent_ids: [parentTaskId],
          commands: [],
          mitre_technique: "T1068",
        }),
        createNode({
          phase: "post",
          title: `Credential harvesting`,
          priority: 2,
          risk_level: "red",
          parent_ids: [parentTaskId],
          commands: [],
          mitre_technique: "T1003",
        }),
        createNode({
          phase: "post",
          title: `Internal network reconnaissance`,
          priority: 3,
          risk_level: "red",
          parent_ids: [parentTaskId],
          commands: [],
          mitre_technique: "T1018",
        }),
      ];
      spawned.push(...postExploitTasks);
      break;
    }
  }

  return spawned;
}
