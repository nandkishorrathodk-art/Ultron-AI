/**
 * Attack Surface Discovery Module
 * ═══════════════════════════════════════════════════════════════
 * Auto-discovers the full attack surface before testing begins.
 * XBOW runs this implicitly — we make it an explicit PTG phase.
 *
 * Discovers:
 *  - Subdomains (subfinder, crt.sh)
 *  - Open ports + services (nmap)
 *  - Web endpoints (crawling, robots.txt, sitemap.xml)
 *  - Technologies (whatweb, HTTP headers)
 *  - API schemas (Swagger/OpenAPI auto-detect)
 * ═══════════════════════════════════════════════════════════════
 */

import { Sandbox } from "e2b";
import { Finding } from "../ptg";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DiscoveredAsset {
  type: "subdomain" | "port" | "endpoint" | "technology" | "api_schema";
  value: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any>;
  source: string;
}

export interface AttackSurface {
  target: string;
  subdomains: string[];
  openPorts: { port: number; service: string; version: string }[];
  endpoints: string[];
  technologies: string[];
  apiSchemas: string[];
  totalAssets: number;
  discoveredAt: number;
}

// ─── Discovery Functions ──────────────────────────────────────────────────────

/**
 * Run subdomain enumeration using subfinder + crt.sh fallback.
 */
export async function discoverSubdomains(
  sandbox: Sandbox,
  target: string,
): Promise<string[]> {
  console.log(`[Discovery] Enumerating subdomains for: ${target}`);

  const subdomains = new Set<string>();

  // 1. Try subfinder
  try {
    const result = await sandbox.commands.run(
      `subfinder -d ${target} -silent -timeout 30 2>/dev/null || echo ""`,
      { timeoutMs: 45000 },
    );
    if (result.stdout) {
      result.stdout
        .trim()
        .split("\n")
        .filter(Boolean)
        .forEach((s) => subdomains.add(s.trim()));
    }
  } catch {
    console.log("[Discovery] subfinder failed, trying crt.sh");
  }

  // 2. Fallback: crt.sh API
  try {
    const result = await sandbox.commands.run(
      `curl -s "https://crt.sh/?q=%25.${target}&output=json" 2>/dev/null | grep -oP '"name_value":"[^"]*"' | cut -d'"' -f4 | sort -u | head -100`,
      { timeoutMs: 15000 },
    );
    if (result.stdout) {
      result.stdout
        .trim()
        .split("\n")
        .filter(Boolean)
        .forEach((s) => subdomains.add(s.trim()));
    }
  } catch {
    console.log("[Discovery] crt.sh fallback also failed");
  }

  // Always include the main target
  subdomains.add(target);

  console.log(`[Discovery] Found ${subdomains.size} subdomains`);
  return Array.from(subdomains);
}

/**
 * Run port scanning on discovered subdomains/IPs.
 */
export async function discoverPorts(
  sandbox: Sandbox,
  target: string,
): Promise<{ port: number; service: string; version: string }[]> {
  console.log(`[Discovery] Port scanning: ${target}`);

  const ports: { port: number; service: string; version: string }[] = [];

  try {
    const result = await sandbox.commands.run(
      `nmap -sV -F -T4 --open ${target} -oG - 2>/dev/null | grep "Ports:"`,
      { timeoutMs: 60000 },
    );

    if (result.stdout) {
      // Parse grepable nmap output
      const portMatches = result.stdout.matchAll(
        /(\d+)\/open\/tcp\/\/([^/]*)\/\/([^/]*)\//g,
      );
      for (const match of portMatches) {
        ports.push({
          port: parseInt(match[1]),
          service: match[2].trim() || "unknown",
          version: match[3].trim() || "unknown",
        });
      }
    }

    // Fallback: parse standard nmap output
    if (ports.length === 0 && result.stdout) {
      const lines = result.stdout.split("\n");
      for (const line of lines) {
        const match = line.match(/^(\d+)\/tcp\s+open\s+(\S+)\s*(.*)/);
        if (match) {
          ports.push({
            port: parseInt(match[1]),
            service: match[2],
            version: match[3].trim() || "unknown",
          });
        }
      }
    }
  } catch {
    console.log("[Discovery] Port scan failed");
  }

  console.log(`[Discovery] Found ${ports.length} open ports`);
  return ports;
}

/**
 * Discover web endpoints via crawling, robots.txt, sitemap.xml.
 */
export async function discoverEndpoints(
  sandbox: Sandbox,
  target: string,
  port: number = 80,
): Promise<string[]> {
  console.log(`[Discovery] Endpoint discovery on ${target}:${port}`);

  const endpoints = new Set<string>();
  const scheme = port === 443 ? "https" : "http";
  const baseUrl = `${scheme}://${target}${port !== 80 && port !== 443 ? `:${port}` : ""}`;

  // 1. robots.txt
  try {
    const result = await sandbox.commands.run(
      `curl -s "${baseUrl}/robots.txt" 2>/dev/null | grep -oP '(Disallow|Allow): \\K.*' | head -50`,
      { timeoutMs: 10000 },
    );
    if (result.stdout) {
      result.stdout
        .trim()
        .split("\n")
        .filter(Boolean)
        .forEach((path) => endpoints.add(path.trim()));
    }
  } catch {
    // Ignore
  }

  // 2. sitemap.xml
  try {
    const result = await sandbox.commands.run(
      `curl -s "${baseUrl}/sitemap.xml" 2>/dev/null | grep -oP '<loc>\\K[^<]+' | head -100`,
      { timeoutMs: 10000 },
    );
    if (result.stdout) {
      result.stdout
        .trim()
        .split("\n")
        .filter(Boolean)
        .forEach((url) => {
          try {
            const parsed = new URL(url);
            endpoints.add(parsed.pathname);
          } catch {
            endpoints.add(url.trim());
          }
        });
    }
  } catch {
    // Ignore
  }

  // 3. Common paths quick check
  const commonPaths = [
    "/api",
    "/api/v1",
    "/api/v2",
    "/admin",
    "/login",
    "/dashboard",
    "/graphql",
    "/swagger.json",
    "/openapi.json",
    "/api-docs",
    "/.env",
    "/.git/HEAD",
    "/wp-admin",
    "/wp-login.php",
    "/actuator",
    "/health",
    "/info",
    "/metrics",
  ];

  try {
    const pathChecks = commonPaths
      .map(
        (p) =>
          `curl -s -o /dev/null -w "%{http_code} ${p}\\n" "${baseUrl}${p}"`,
      )
      .join(" && ");

    const result = await sandbox.commands.run(pathChecks, { timeoutMs: 30000 });

    if (result.stdout) {
      const lines = result.stdout.trim().split("\n");
      for (const line of lines) {
        const match = line.match(/^(200|301|302|403)\s+(.+)/);
        if (match) {
          endpoints.add(match[2].trim());
        }
      }
    }
  } catch {
    // Ignore
  }

  console.log(`[Discovery] Found ${endpoints.size} endpoints`);
  return Array.from(endpoints);
}

/**
 * Fingerprint technologies used by the target.
 */
export async function discoverTechnologies(
  sandbox: Sandbox,
  target: string,
): Promise<string[]> {
  console.log(`[Discovery] Technology fingerprinting: ${target}`);

  const techs = new Set<string>();

  // 1. whatweb
  try {
    const result = await sandbox.commands.run(
      `whatweb -a 3 ${target} --log-brief=/dev/stdout 2>/dev/null || echo ""`,
      { timeoutMs: 30000 },
    );
    if (result.stdout) {
      // Extract tech names from whatweb output
      const matches = result.stdout.matchAll(/\[([^\]]+)\]/g);
      for (const match of matches) {
        techs.add(match[1]);
      }
    }
  } catch {
    // Ignore
  }

  // 2. HTTP response headers
  try {
    const result = await sandbox.commands.run(
      `curl -sI "https://${target}" 2>/dev/null || curl -sI "http://${target}" 2>/dev/null`,
      { timeoutMs: 10000 },
    );
    if (result.stdout) {
      const headers = result.stdout.toLowerCase();
      // Detect common technologies from headers
      const headerTechs: Record<string, string> = {
        "x-powered-by: php": "PHP",
        "x-powered-by: express": "Express.js",
        "x-powered-by: asp.net": "ASP.NET",
        "server: nginx": "nginx",
        "server: apache": "Apache",
        "server: cloudflare": "Cloudflare",
        "x-drupal": "Drupal",
        "x-generator: wordpress": "WordPress",
        "x-aspnet-version": "ASP.NET",
      };

      for (const [pattern, tech] of Object.entries(headerTechs)) {
        if (headers.includes(pattern)) {
          techs.add(tech);
        }
      }
    }
  } catch {
    // Ignore
  }

  console.log(`[Discovery] Found ${techs.size} technologies`);
  return Array.from(techs);
}

/**
 * Check for API schema endpoints (Swagger/OpenAPI).
 */
export async function discoverAPISchemas(
  sandbox: Sandbox,
  target: string,
): Promise<string[]> {
  console.log(`[Discovery] API schema detection: ${target}`);

  const schemas: string[] = [];
  const schemaPaths = [
    "/swagger.json",
    "/swagger/v1/swagger.json",
    "/openapi.json",
    "/api-docs",
    "/api-docs/swagger.json",
    "/v1/api-docs",
    "/v2/api-docs",
    "/v3/api-docs",
    "/graphql",
    "/.well-known/openapi.yaml",
  ];

  for (const path of schemaPaths) {
    try {
      const result = await sandbox.commands.run(
        `curl -s -o /dev/null -w "%{http_code}" "https://${target}${path}" 2>/dev/null || curl -s -o /dev/null -w "%{http_code}" "http://${target}${path}" 2>/dev/null`,
        { timeoutMs: 5000 },
      );
      if (result.stdout?.trim() === "200") {
        schemas.push(path);
      }
    } catch {
      // Ignore timeouts
    }
  }

  console.log(`[Discovery] Found ${schemas.length} API schemas`);
  return schemas;
}

// ─── Full Discovery Pipeline ──────────────────────────────────────────────────

/**
 * Run the complete attack surface discovery pipeline.
 * Returns a structured AttackSurface object.
 */
export async function discoverAttackSurface(
  sandbox: Sandbox,
  target: string,
): Promise<AttackSurface> {
  console.log(
    `\n[Discovery] ═══ Starting full attack surface discovery for: ${target} ═══\n`,
  );

  // Run discovery phases (some can be parallel)
  const [subdomains, ports, technologies] = await Promise.all([
    discoverSubdomains(sandbox, target),
    discoverPorts(sandbox, target),
    discoverTechnologies(sandbox, target),
  ]);

  // Endpoint discovery depends on knowing the web ports
  const webPorts = ports.filter(
    (p) =>
      ["http", "https", "http-alt"].includes(p.service) ||
      [80, 443, 8080, 8443].includes(p.port),
  );

  const endpoints: string[] = [];
  for (const wp of webPorts.slice(0, 3)) {
    // Limit to 3 web ports
    const eps = await discoverEndpoints(sandbox, target, wp.port);
    endpoints.push(...eps);
  }

  // API schema detection
  const apiSchemas = await discoverAPISchemas(sandbox, target);

  const surface: AttackSurface = {
    target,
    subdomains,
    openPorts: ports,
    endpoints: [...new Set(endpoints)],
    technologies,
    apiSchemas,
    totalAssets:
      subdomains.length +
      ports.length +
      endpoints.length +
      technologies.length +
      apiSchemas.length,
    discoveredAt: Date.now(),
  };

  console.log(`\n[Discovery] ═══ Attack Surface Summary ═══`);
  console.log(`  Subdomains:    ${subdomains.length}`);
  console.log(`  Open Ports:    ${ports.length}`);
  console.log(`  Endpoints:     ${endpoints.length}`);
  console.log(`  Technologies:  ${technologies.length}`);
  console.log(`  API Schemas:   ${apiSchemas.length}`);
  console.log(`  Total Assets:  ${surface.totalAssets}`);
  console.log(`═══════════════════════════════════════\n`);

  return surface;
}

/**
 * Convert an AttackSurface into PTG-compatible findings for downstream processing.
 */
export function surfaceToFindings(surface: AttackSurface): Finding[] {
  const findings: Finding[] = [];

  for (const port of surface.openPorts) {
    findings.push({
      type: "open_port",
      severity: "info",
      description: `Port ${port.port}/${port.service} (${port.version})`,
      raw_output: `${port.port}/tcp open ${port.service} ${port.version}`,
      cve_ids: [],
      cvss_score: 0,
      epss_score: 0,
      remediation: "Review if this service needs to be publicly exposed",
      evidence: `nmap scan: ${port.port}/tcp open`,
      endpoint: `${surface.target}:${port.port}`,
    });
  }

  for (const port of surface.openPorts) {
    if (port.version && port.version !== "unknown") {
      findings.push({
        type: "service",
        severity: "info",
        description: `${port.service} ${port.version} on port ${port.port}`,
        raw_output: `${port.service} ${port.version}`,
        cve_ids: [],
        cvss_score: 0,
        epss_score: 0,
        remediation: "Keep service updated to latest version",
        evidence: `Service detected: ${port.service} ${port.version}`,
        endpoint: `${surface.target}:${port.port}`,
      });
    }
  }

  return findings;
}
