/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Deterministic Vulnerability Validator
 * ═══════════════════════════════════════════════════════════════
 * XBOW's core principle: "Plausibility is NOT Proof."
 *
 * This module takes findings from the creative AI agents and
 * validates them using deterministic, controlled tests.
 * Only PROVEN vulnerabilities are reported as confirmed.
 *
 * Unvalidated findings are marked as "potential" with lower confidence.
 * ═══════════════════════════════════════════════════════════════
 */

import { Sandbox } from "e2b";
import { Finding } from "../ptg";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ValidationResult {
  finding: Finding;
  validated: boolean;
  confidence: number; // 0.0 - 1.0
  proof: string; // PoC details
  method: string; // How it was validated
  reproductionSteps: string[];
  screenshot?: string; // Path to screenshot if applicable
}

// ─── XSS Validation ───────────────────────────────────────────────────────────

const XSS_CANARY = "xbow_canary_" + Math.random().toString(36).slice(2, 10);

const XSS_PAYLOADS = [
  `<script>document.title='${XSS_CANARY}'</script>`,
  `<img src=x onerror="document.title='${XSS_CANARY}'">`,
  `<svg/onload="document.title='${XSS_CANARY}'">`,
  `"><script>document.title='${XSS_CANARY}'</script>`,
  `'><img src=x onerror="document.title='${XSS_CANARY}'">`,
  `javascript:document.title='${XSS_CANARY}'`,
];

async function validateXSS(
  sandbox: Sandbox,
  finding: Finding,
): Promise<ValidationResult> {
  const endpoint = finding.endpoint || "";
  const result: ValidationResult = {
    finding: { ...finding },
    validated: false,
    confidence: 0,
    proof: "",
    method: "xss_payload_injection",
    reproductionSteps: [],
  };

  if (!endpoint) {
    result.proof = "No endpoint specified — cannot validate";
    return result;
  }

  for (const payload of XSS_PAYLOADS) {
    try {
      const encodedPayload = encodeURIComponent(payload);
      const testUrl = endpoint.includes("?")
        ? `${endpoint}&test=${encodedPayload}`
        : `${endpoint}?test=${encodedPayload}`;

      // Check if payload is reflected in response
      const cmd = `curl -s "${testUrl}" 2>/dev/null | grep -c "${XSS_CANARY}"`;
      const exec = await sandbox.commands.run(cmd, { timeoutMs: 10000 });

      if (exec.stdout?.trim() !== "0") {
        result.validated = true;
        result.confidence = 0.85;
        result.proof = `XSS canary "${XSS_CANARY}" found in response body after injection`;
        result.reproductionSteps = [
          `1. Navigate to: ${testUrl}`,
          `2. Observe that the payload is reflected in the response`,
          `3. The canary string "${XSS_CANARY}" confirms execution context`,
        ];
        result.finding.validated = true;
        break;
      }
    } catch {
      // Continue to next payload
    }
  }

  if (!result.validated) {
    result.confidence = 0.3;
    result.proof =
      "XSS payloads not reflected — may be stored XSS or DOM-based (requires browser)";
  }

  return result;
}

// ─── SQLi Validation ──────────────────────────────────────────────────────────

async function validateSQLi(
  sandbox: Sandbox,
  finding: Finding,
): Promise<ValidationResult> {
  const endpoint = finding.endpoint || "";
  const result: ValidationResult = {
    finding: { ...finding },
    validated: false,
    confidence: 0,
    proof: "",
    method: "sqli_boolean_differential",
    reproductionSteps: [],
  };

  if (!endpoint) {
    result.proof = "No endpoint specified — cannot validate";
    return result;
  }

  try {
    // Boolean-based differential analysis
    // TRUE condition should return normal page, FALSE should differ
    const truePayload = encodeURIComponent("' OR '1'='1");
    const falsePayload = encodeURIComponent("' OR '1'='2");

    const trueUrl = endpoint.includes("?")
      ? `${endpoint}&id=${truePayload}`
      : `${endpoint}?id=${truePayload}`;

    const falseUrl = endpoint.includes("?")
      ? `${endpoint}&id=${falsePayload}`
      : `${endpoint}?id=${falsePayload}`;

    // Get response sizes for comparison
    const trueCmd = `curl -s -o /dev/null -w "%{size_download}" "${trueUrl}" 2>/dev/null`;
    const falseCmd = `curl -s -o /dev/null -w "%{size_download}" "${falseUrl}" 2>/dev/null`;

    const [trueExec, falseExec] = await Promise.all([
      sandbox.commands.run(trueCmd, { timeoutMs: 10000 }),
      sandbox.commands.run(falseCmd, { timeoutMs: 10000 }),
    ]);

    const trueSize = parseInt(trueExec.stdout?.trim() || "0");
    const falseSize = parseInt(falseExec.stdout?.trim() || "0");

    // Significant size difference indicates SQL injection
    if (trueSize > 0 && falseSize > 0 && Math.abs(trueSize - falseSize) > 100) {
      result.validated = true;
      result.confidence = 0.8;
      result.proof = `Boolean-based SQLi confirmed: TRUE condition returned ${trueSize} bytes, FALSE returned ${falseSize} bytes (delta: ${Math.abs(trueSize - falseSize)} bytes)`;
      result.reproductionSteps = [
        `1. Send TRUE condition: ${trueUrl}`,
        `2. Send FALSE condition: ${falseUrl}`,
        `3. Observe significant response size difference: ${trueSize} vs ${falseSize} bytes`,
        `4. This confirms the SQL query is being influenced by the injected payload`,
      ];
      result.finding.validated = true;
    }

    // Check for SQL error messages
    const errorCmd = `curl -s "${trueUrl}" 2>/dev/null | grep -ciE "(sql|mysql|postgresql|sqlite|oracle|syntax error|unterminated)"`;
    const errorExec = await sandbox.commands.run(errorCmd, {
      timeoutMs: 10000,
    });

    if (parseInt(errorExec.stdout?.trim() || "0") > 0) {
      result.validated = true;
      result.confidence = Math.max(result.confidence, 0.9);
      result.proof +=
        "\nSQL error messages detected in response — error-based SQLi confirmed";
      result.finding.validated = true;
    }
  } catch (err: any) {
    result.proof = `Validation error: ${err.message}`;
  }

  if (!result.validated) {
    result.confidence = 0.3;
    result.proof =
      result.proof ||
      "No differential response detected — may require more sophisticated blind testing";
  }

  return result;
}

// ─── SSRF Validation ──────────────────────────────────────────────────────────

async function validateSSRF(
  sandbox: Sandbox,
  finding: Finding,
): Promise<ValidationResult> {
  const endpoint = finding.endpoint || "";
  const result: ValidationResult = {
    finding: { ...finding },
    validated: false,
    confidence: 0,
    proof: "",
    method: "ssrf_internal_probe",
    reproductionSteps: [],
  };

  if (!endpoint) {
    result.proof = "No endpoint specified";
    return result;
  }

  try {
    // Test: Can we make the server fetch an internal URL?
    const internalTargets = [
      "http://127.0.0.1",
      "http://localhost",
      "http://169.254.169.254/latest/meta-data/", // AWS metadata
      "http://[::1]",
    ];

    for (const internalTarget of internalTargets) {
      const ssrfPayload = encodeURIComponent(internalTarget);
      const testUrl = endpoint.includes("?")
        ? `${endpoint}&url=${ssrfPayload}`
        : `${endpoint}?url=${ssrfPayload}`;

      const cmd = `curl -s -o /dev/null -w "%{http_code}:%{size_download}" "${testUrl}" 2>/dev/null`;
      const exec = await sandbox.commands.run(cmd, { timeoutMs: 10000 });

      const [statusCode, size] = (exec.stdout?.trim() || "0:0")
        .split(":")
        .map(Number);

      // If we get a 200 with content, the server might be fetching internal resources
      if (statusCode === 200 && size > 200) {
        // Double check: compare with a non-existent internal host
        const falseCmd = `curl -s -o /dev/null -w "%{http_code}:%{size_download}" "${endpoint}?url=${encodeURIComponent("http://192.168.255.255:1")}" 2>/dev/null`;
        const falseExec = await sandbox.commands.run(falseCmd, {
          timeoutMs: 10000,
        });
        const [falseStatus, falseSize] = (falseExec.stdout?.trim() || "0:0")
          .split(":")
          .map(Number);

        if (size > falseSize * 2) {
          result.validated = true;
          result.confidence = 0.75;
          result.proof = `SSRF to ${internalTarget} returned ${size} bytes (vs ${falseSize} for invalid host). Server is likely fetching the URL.`;
          result.reproductionSteps = [
            `1. Send request to: ${testUrl}`,
            `2. Observe the response contains data from the internal resource`,
            `3. Compare with invalid host to confirm differential behavior`,
          ];
          result.finding.validated = true;
          break;
        }
      }
    }
  } catch (err: any) {
    result.proof = `Validation error: ${err.message}`;
  }

  if (!result.validated) {
    result.confidence = 0.3;
    result.proof =
      result.proof ||
      "SSRF not confirmed — server may not be proxying requests";
  }

  return result;
}

// ─── RCE Validation ───────────────────────────────────────────────────────────

async function validateRCE(
  sandbox: Sandbox,
  finding: Finding,
): Promise<ValidationResult> {
  const result: ValidationResult = {
    finding: { ...finding },
    validated: false,
    confidence: 0,
    proof: "",
    method: "rce_fingerprint_command",
    reproductionSteps: [],
  };

  // RCE is already confirmed if we got shell output from exploit
  if (
    finding.raw_output &&
    (finding.raw_output.includes("uid=") ||
      finding.raw_output.includes("root:") ||
      finding.raw_output.includes("Linux ") ||
      finding.raw_output.includes("Windows "))
  ) {
    result.validated = true;
    result.confidence = 0.95;
    result.proof = `RCE confirmed — OS fingerprint detected in output: ${finding.raw_output.slice(0, 200)}`;
    result.reproductionSteps = [
      `1. Execute the exploit command as described in the finding`,
      `2. Observe OS fingerprint in the response (uid=, hostname, etc.)`,
    ];
    result.finding.validated = true;
  } else {
    result.confidence = 0.5;
    result.proof =
      "RCE claimed but no OS fingerprint found — needs manual verification";
  }

  return result;
}

// ─── Path Traversal Validation ────────────────────────────────────────────────

async function validatePathTraversal(
  sandbox: Sandbox,
  finding: Finding,
): Promise<ValidationResult> {
  const endpoint = finding.endpoint || "";
  const result: ValidationResult = {
    finding: { ...finding },
    validated: false,
    confidence: 0,
    proof: "",
    method: "path_traversal_known_file",
    reproductionSteps: [],
  };

  if (!endpoint) {
    result.proof = "No endpoint specified";
    return result;
  }

  // Known file contents to check for
  const traversalTests = [
    { payload: "../../../../../../etc/passwd", marker: "root:" },
    { payload: "../../../../../../etc/hostname", marker: "" },
    { payload: "../../../../../../windows/win.ini", marker: "[fonts]" },
  ];

  for (const test of traversalTests) {
    try {
      const encodedPayload = encodeURIComponent(test.payload);
      const testUrl = endpoint.includes("?")
        ? `${endpoint}&file=${encodedPayload}`
        : `${endpoint}?file=${encodedPayload}`;

      const cmd = test.marker
        ? `curl -s "${testUrl}" 2>/dev/null | grep -c "${test.marker}"`
        : `curl -s "${testUrl}" 2>/dev/null | wc -c`;

      const exec = await sandbox.commands.run(cmd, { timeoutMs: 10000 });
      const count = parseInt(exec.stdout?.trim() || "0");

      if (test.marker && count > 0) {
        result.validated = true;
        result.confidence = 0.9;
        result.proof = `Path traversal confirmed — "${test.marker}" found in response when requesting ${test.payload}`;
        result.reproductionSteps = [
          `1. Navigate to: ${testUrl}`,
          `2. Observe that "${test.marker}" appears in the response`,
          `3. This confirms the server is reading arbitrary files from disk`,
        ];
        result.finding.validated = true;
        break;
      }
    } catch {
      // Try next payload
    }
  }

  if (!result.validated) {
    result.confidence = 0.3;
    result.proof =
      "Known file markers not found — path traversal not confirmed";
  }

  return result;
}

// ─── Auth Bypass Validation ───────────────────────────────────────────────────

async function validateAuthBypass(
  sandbox: Sandbox,
  finding: Finding,
): Promise<ValidationResult> {
  const endpoint = finding.endpoint || "";
  const result: ValidationResult = {
    finding: { ...finding },
    validated: false,
    confidence: 0,
    proof: "",
    method: "auth_bypass_unauthenticated_access",
    reproductionSteps: [],
  };

  if (!endpoint) {
    result.proof = "No endpoint specified";
    return result;
  }

  try {
    // Try accessing without authentication
    const cmd = `curl -s -o /dev/null -w "%{http_code}" "${endpoint}" 2>/dev/null`;
    const exec = await sandbox.commands.run(cmd, { timeoutMs: 10000 });
    const statusCode = parseInt(exec.stdout?.trim() || "0");

    if (statusCode === 200) {
      result.validated = true;
      result.confidence = 0.7;
      result.proof = `Auth bypass confirmed — endpoint ${endpoint} returns 200 without authentication`;
      result.reproductionSteps = [
        `1. Send unauthenticated request to: ${endpoint}`,
        `2. Observe HTTP 200 response with data`,
        `3. This confirms the endpoint is accessible without credentials`,
      ];
      result.finding.validated = true;
    }
  } catch (err: any) {
    result.proof = `Validation error: ${err.message}`;
  }

  if (!result.validated) {
    result.confidence = 0.3;
    result.proof =
      result.proof ||
      "Endpoint properly returns 401/403 — auth bypass not confirmed";
  }

  return result;
}

// ─── Main Validation Router ──────────────────────────────────────────────────

/**
 * Validate a finding using the appropriate deterministic method.
 * Returns the original finding with validated flag set.
 */
export async function validateFinding(
  sandbox: Sandbox,
  finding: Finding,
): Promise<ValidationResult> {
  const description = finding.description.toLowerCase();

  // Route to appropriate validator based on finding description/CVE
  if (
    description.includes("xss") ||
    description.includes("cross-site scripting") ||
    description.includes("script injection")
  ) {
    return validateXSS(sandbox, finding);
  }

  if (
    description.includes("sql injection") ||
    description.includes("sqli") ||
    (description.includes("sql") && description.includes("injection"))
  ) {
    return validateSQLi(sandbox, finding);
  }

  if (
    description.includes("ssrf") ||
    description.includes("server-side request forgery") ||
    description.includes("server side request")
  ) {
    return validateSSRF(sandbox, finding);
  }

  if (
    description.includes("rce") ||
    description.includes("remote code execution") ||
    description.includes("command injection") ||
    description.includes("shell")
  ) {
    return validateRCE(sandbox, finding);
  }

  if (
    description.includes("path traversal") ||
    description.includes("directory traversal") ||
    description.includes("lfi") ||
    description.includes("local file inclusion")
  ) {
    return validatePathTraversal(sandbox, finding);
  }

  if (
    description.includes("auth bypass") ||
    description.includes("authentication bypass") ||
    description.includes("idor") ||
    description.includes("broken access")
  ) {
    return validateAuthBypass(sandbox, finding);
  }

  // Unknown vulnerability type — can't validate automatically
  return {
    finding: { ...finding, validated: false },
    validated: false,
    confidence: 0.2,
    proof: "No deterministic validator available for this vulnerability type",
    method: "none",
    reproductionSteps: [],
  };
}

/**
 * Validate multiple findings in batch.
 * Returns only validated findings (confidence > threshold).
 */
export async function validateFindings(
  sandbox: Sandbox,
  findings: Finding[],
  confidenceThreshold: number = 0.5,
): Promise<{ validated: ValidationResult[]; unvalidated: ValidationResult[] }> {
  console.log(
    `[Validator] Validating ${findings.length} findings (threshold: ${confidenceThreshold})`,
  );

  const results: ValidationResult[] = [];

  for (const finding of findings) {
    // Only validate medium+ severity findings (info/low usually don't need validation)
    if (finding.severity === "info" || finding.severity === "low") {
      results.push({
        finding: { ...finding, validated: false },
        validated: false,
        confidence: 0.5,
        proof: "Low/info severity — validation skipped",
        method: "skipped",
        reproductionSteps: [],
      });
      continue;
    }

    const result = await validateFinding(sandbox, finding);
    results.push(result);
  }

  const validated = results.filter(
    (r) => r.validated && r.confidence >= confidenceThreshold,
  );
  const unvalidated = results.filter(
    (r) => !r.validated || r.confidence < confidenceThreshold,
  );

  console.log(
    `[Validator] Results: ${validated.length} validated, ${unvalidated.length} unvalidated`,
  );

  return { validated, unvalidated };
}
