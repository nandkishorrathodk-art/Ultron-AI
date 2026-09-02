/**
 * Adaptive Attack Strategies
 * ═══════════════════════════════════════════════════════════════
 * XBOW-inspired strategy engine. When an attack is blocked by
 * WAF, input validation, or rate limiting, the agent adapts
 * its approach automatically.
 *
 * Key principle: "If blocked, pivot — don't give up."
 * ═══════════════════════════════════════════════════════════════
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type BlockReason =
  | "waf_signature"       // WAF blocked the payload
  | "rate_limit"          // Too many requests
  | "input_validation"    // Server-side validation rejected input
  | "auth_required"       // Need credentials
  | "timeout"             // Command/request timed out
  | "connection_refused"  // Port/service not reachable
  | "unknown";

export type EncodingType =
  | "none"
  | "url_encode"
  | "double_url_encode"
  | "base64"
  | "unicode"
  | "hex"
  | "html_entities"
  | "octal";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";

export interface AttackStrategy {
  id: string;
  encoding: EncodingType;
  httpMethod: HttpMethod;
  delay: number;              // ms between requests
  payloadVariant: number;     // which payload variant to use
  headers: Record<string, string>;
  bypassTechniques: string[];
  description: string;
}

export interface FailedAttempt {
  strategy: AttackStrategy;
  error: string;
  httpStatus?: number;
  responseBody?: string;
  blockReason: BlockReason;
  timestamp: number;
}

// ─── Block Reason Detection ───────────────────────────────────────────────────

const WAF_SIGNATURES = [
  "403 forbidden",
  "access denied",
  "blocked by",
  "waf",
  "cloudflare",
  "mod_security",
  "request blocked",
  "suspicious activity",
  "security violation",
  "not acceptable",
];

const RATE_LIMIT_SIGNATURES = [
  "429",
  "rate limit",
  "too many requests",
  "throttled",
  "retry-after",
  "slow down",
];

const INPUT_VALIDATION_SIGNATURES = [
  "invalid input",
  "validation error",
  "bad request",
  "malformed",
  "illegal character",
  "xss detected",
  "sql injection detected",
];

export function detectBlockReason(
  stdout: string,
  stderr: string,
  exitCode: number,
  httpStatus?: number
): BlockReason {
  const combined = `${stdout} ${stderr}`.toLowerCase();

  if (httpStatus === 429 || RATE_LIMIT_SIGNATURES.some((s) => combined.includes(s))) {
    return "rate_limit";
  }
  if (httpStatus === 403 || WAF_SIGNATURES.some((s) => combined.includes(s))) {
    return "waf_signature";
  }
  if (httpStatus === 400 || INPUT_VALIDATION_SIGNATURES.some((s) => combined.includes(s))) {
    return "input_validation";
  }
  if (httpStatus === 401 || httpStatus === 407 || combined.includes("unauthorized")) {
    return "auth_required";
  }
  if (combined.includes("timed out") || combined.includes("timeout")) {
    return "timeout";
  }
  if (combined.includes("connection refused") || combined.includes("no route to host")) {
    return "connection_refused";
  }

  return "unknown";
}

// ─── Payload Encoding ─────────────────────────────────────────────────────────

export function encodePayload(payload: string, encoding: EncodingType): string {
  switch (encoding) {
    case "none":
      return payload;
    case "url_encode":
      return encodeURIComponent(payload);
    case "double_url_encode":
      return encodeURIComponent(encodeURIComponent(payload));
    case "base64":
      return Buffer.from(payload).toString("base64");
    case "unicode":
      return payload
        .split("")
        .map((c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`)
        .join("");
    case "hex":
      return payload
        .split("")
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join("");
    case "html_entities":
      return payload
        .split("")
        .map((c) => `&#${c.charCodeAt(0)};`)
        .join("");
    case "octal":
      return payload
        .split("")
        .map((c) => `\\${c.charCodeAt(0).toString(8)}`)
        .join("");
    default:
      return payload;
  }
}

// ─── Strategy Adaptation ──────────────────────────────────────────────────────

const DEFAULT_STRATEGY: AttackStrategy = {
  id: "default",
  encoding: "none",
  httpMethod: "GET",
  delay: 0,
  payloadVariant: 0,
  headers: {},
  bypassTechniques: [],
  description: "Default — no encoding, no delay",
};

/**
 * Given a failed attempt, generate the next adapted strategy.
 * This is the core of XBOW-style adaptive reasoning.
 */
export function adaptStrategy(
  failedAttempt: FailedAttempt,
  attemptNumber: number
): AttackStrategy {
  const { blockReason, strategy: prevStrategy } = failedAttempt;

  switch (blockReason) {
    case "waf_signature":
      return adaptForWAF(prevStrategy, attemptNumber);
    case "rate_limit":
      return adaptForRateLimit(prevStrategy, attemptNumber);
    case "input_validation":
      return adaptForInputValidation(prevStrategy, attemptNumber);
    case "auth_required":
      return adaptForAuth(prevStrategy, attemptNumber);
    case "timeout":
      return adaptForTimeout(prevStrategy, attemptNumber);
    case "connection_refused":
      return {
        ...prevStrategy,
        id: `retry_${attemptNumber}`,
        delay: 5000 * attemptNumber,
        description: `Connection retry with ${5 * attemptNumber}s delay`,
      };
    default:
      return nextPayloadVariant(prevStrategy, attemptNumber);
  }
}

function adaptForWAF(prev: AttackStrategy, attempt: number): AttackStrategy {
  // Escalating WAF bypass techniques
  const wafStrategies: Partial<AttackStrategy>[] = [
    {
      encoding: "url_encode",
      description: "WAF bypass: URL encoding",
    },
    {
      encoding: "double_url_encode",
      description: "WAF bypass: Double URL encoding",
    },
    {
      encoding: "unicode",
      bypassTechniques: ["unicode_normalization"],
      description: "WAF bypass: Unicode encoding",
    },
    {
      httpMethod: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      description: "WAF bypass: Switch to POST",
    },
    {
      encoding: "hex",
      headers: { "X-Forwarded-For": "127.0.0.1" },
      bypassTechniques: ["ip_spoofing_header", "hex_encoding"],
      description: "WAF bypass: Hex encoding + IP spoof header",
    },
    {
      encoding: "html_entities",
      httpMethod: "PUT",
      bypassTechniques: ["method_override", "html_entity_encoding"],
      description: "WAF bypass: HTML entities + PUT method",
    },
    {
      headers: {
        "Content-Type": "multipart/form-data",
        "Transfer-Encoding": "chunked",
      },
      bypassTechniques: ["chunked_encoding", "content_type_mismatch"],
      description: "WAF bypass: Chunked transfer + content type confusion",
    },
    {
      encoding: "base64",
      headers: { "X-HTTP-Method-Override": "POST" },
      bypassTechniques: ["method_override", "base64_payload"],
      description: "WAF bypass: Base64 payload + method override",
    },
  ];

  const idx = Math.min(attempt, wafStrategies.length - 1);
  return {
    ...prev,
    ...wafStrategies[idx],
    id: `waf_bypass_${attempt}`,
    payloadVariant: attempt,
  };
}

function adaptForRateLimit(prev: AttackStrategy, attempt: number): AttackStrategy {
  // Exponential backoff with jitter
  const baseDelay = 2000;
  const jitter = Math.random() * 1000;
  const delay = baseDelay * Math.pow(2, attempt) + jitter;

  return {
    ...prev,
    id: `rate_limit_${attempt}`,
    delay: Math.min(delay, 60000), // Cap at 60s
    headers: {
      ...prev.headers,
      "X-Forwarded-For": `${10 + attempt}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    },
    bypassTechniques: [...prev.bypassTechniques, "rate_limit_jitter"],
    description: `Rate limit bypass: ${Math.round(delay)}ms delay + IP rotation`,
  };
}

function adaptForInputValidation(prev: AttackStrategy, attempt: number): AttackStrategy {
  const validationBypass: Partial<AttackStrategy>[] = [
    {
      encoding: "url_encode",
      description: "Validation bypass: URL encode special chars",
    },
    {
      encoding: "unicode",
      bypassTechniques: ["unicode_normalization"],
      description: "Validation bypass: Unicode normalization attack",
    },
    {
      encoding: "double_url_encode",
      bypassTechniques: ["double_encoding"],
      description: "Validation bypass: Double encoding",
    },
    {
      encoding: "octal",
      bypassTechniques: ["octal_encoding"],
      description: "Validation bypass: Octal encoding",
    },
    {
      bypassTechniques: ["null_byte_injection"],
      description: "Validation bypass: Null byte injection",
    },
  ];

  const idx = Math.min(attempt, validationBypass.length - 1);
  return {
    ...prev,
    ...validationBypass[idx],
    id: `validation_bypass_${attempt}`,
    payloadVariant: attempt,
  };
}

function adaptForAuth(prev: AttackStrategy, attempt: number): AttackStrategy {
  return {
    ...prev,
    id: `auth_bypass_${attempt}`,
    bypassTechniques: [
      "default_credentials",
      "jwt_none_algorithm",
      "parameter_pollution",
      "idor_check",
    ],
    description: "Auth bypass: Try default creds, JWT none alg, IDOR",
  };
}

function adaptForTimeout(prev: AttackStrategy, attempt: number): AttackStrategy {
  return {
    ...prev,
    id: `timeout_retry_${attempt}`,
    delay: 1000 * attempt,
    description: `Timeout retry: simplified payload with ${attempt}s delay`,
  };
}

function nextPayloadVariant(prev: AttackStrategy, attempt: number): AttackStrategy {
  return {
    ...prev,
    id: `variant_${attempt}`,
    payloadVariant: prev.payloadVariant + 1,
    description: `Payload variant #${prev.payloadVariant + 1}`,
  };
}

// ─── Strategy Builder ─────────────────────────────────────────────────────────

/**
 * Generate an initial set of strategies for a given vulnerability type.
 * The coordinator cycles through these before falling back to adaptive mode.
 */
export function buildInitialStrategies(vulnType: string): AttackStrategy[] {
  const base = { ...DEFAULT_STRATEGY };

  switch (vulnType) {
    case "xss":
      return [
        { ...base, id: "xss_reflected", description: "Reflected XSS — standard payloads" },
        { ...base, id: "xss_encoded", encoding: "url_encode", description: "XSS — URL encoded" },
        { ...base, id: "xss_dom", description: "DOM XSS — JavaScript context" },
        { ...base, id: "xss_svg", description: "XSS via SVG/event handlers" },
        { ...base, id: "xss_unicode", encoding: "unicode", description: "XSS — Unicode bypass" },
      ];

    case "sqli":
      return [
        { ...base, id: "sqli_union", description: "SQLi — UNION-based" },
        { ...base, id: "sqli_boolean", description: "SQLi — Boolean blind" },
        { ...base, id: "sqli_time", description: "SQLi — Time-based blind" },
        { ...base, id: "sqli_error", description: "SQLi — Error-based" },
        { ...base, id: "sqli_stacked", description: "SQLi — Stacked queries" },
      ];

    case "ssrf":
      return [
        { ...base, id: "ssrf_direct", description: "SSRF — Direct URL" },
        { ...base, id: "ssrf_encoded", encoding: "url_encode", description: "SSRF — Encoded URL" },
        { ...base, id: "ssrf_redirect", description: "SSRF — Open redirect chain" },
        { ...base, id: "ssrf_dns", description: "SSRF — DNS rebinding" },
        { ...base, id: "ssrf_cloud", description: "SSRF — Cloud metadata (169.254.169.254)" },
      ];

    case "rce":
      return [
        { ...base, id: "rce_direct", description: "RCE — Direct command injection" },
        { ...base, id: "rce_chained", description: "RCE — Chained with ; | && ||" },
        { ...base, id: "rce_backtick", description: "RCE — Backtick substitution" },
        { ...base, id: "rce_newline", description: "RCE — Newline injection" },
      ];

    case "path_traversal":
      return [
        { ...base, id: "pt_basic", description: "Path traversal — ../../../etc/passwd" },
        { ...base, id: "pt_encoded", encoding: "url_encode", description: "Path traversal — URL encoded" },
        { ...base, id: "pt_double", encoding: "double_url_encode", description: "Path traversal — Double encoded" },
        { ...base, id: "pt_null", description: "Path traversal — Null byte (%00)" },
        { ...base, id: "pt_unicode", encoding: "unicode", description: "Path traversal — Unicode" },
      ];

    default:
      return [base];
  }
}

export { DEFAULT_STRATEGY };
