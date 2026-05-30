/**
 * Environment Variable Validation
 * ════════════════════════════════════════════════════════════════
 * Validates all required and optional environment variables at startup.
 * Provides clear error messages instead of cryptic runtime failures.
 * 
 * Desktop Note: For local development, fallbacks are provided.
 * For production, all required vars must be set.
 */

export interface EnvValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

const REQUIRED_PRODUCTION = [
  "NEXT_PUBLIC_CONVEX_URL",
  "NVIDIA_API_KEY",
  "NEO4J_URI",
  "QDRANT_URL",
];

const OPTIONAL_WITH_FALLBACK = [
  { key: "NEO4J_USER", default: "neo4j", fallback: true },
  { key: "NEO4J_PASSWORD", default: "", fallback: true },
  { key: "QDRANT_API_KEY", default: "", fallback: true },
  { key: "OPENROUTER_API_KEY", default: "", fallback: true },
];

const OPTIONAL_SERVICES = [
  "STRIPE_SECRET_KEY",
  "WORKOS_API_KEY",
  "E2B_API_KEY",
  "OPENAI_API_KEY",
  "PERPLEXITY_API_KEY",
];

/**
 * Validate environment at startup
 * Returns validation result with errors and warnings
 */
export function validateEnvironment(
  isDevelopment = process.env.NODE_ENV === "development"
): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required production vars
  if (!isDevelopment) {
    for (const key of REQUIRED_PRODUCTION) {
      if (!process.env[key]) {
        errors.push(`[CRITICAL] Missing required env var: ${key}`);
      }
    }
  }

  // Check optional vars with fallbacks (warn if missing in production)
  for (const { key, fallback } of OPTIONAL_WITH_FALLBACK) {
    if (!process.env[key]) {
      if (fallback && !isDevelopment) {
        warnings.push(`Using fallback for ${key}. For production, set explicitly.`);
      }
    }
  }

  // Warn about important optional services
  const missingServices = OPTIONAL_SERVICES.filter((key) => !process.env[key]);
  if (missingServices.length > 0 && !isDevelopment) {
    warnings.push(
      `Optional services not configured: ${missingServices.join(", ")}. ` +
      `Some features may be unavailable.`
    );
  }

  // Desktop-specific checks
  if (isDevelopment) {
    if (!process.env.NVIDIA_API_KEY) {
      warnings.push(
        "[Desktop] NVIDIA_API_KEY not set. Using OpenRouter fallback. " +
        "Performance may be reduced."
      );
    }
    if (!process.env.NEO4J_URI) {
      warnings.push(
        "[Desktop] NEO4J_URI not set. Using local MemGraph defaults. " +
        "Knowledge graph features will be local-only."
      );
    }
    if (!process.env.QDRANT_URL) {
      warnings.push(
        "[Desktop] QDRANT_URL not set. Using local Qdrant defaults. " +
        "RAG context will be unavailable."
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate and throw if critical errors found
 * Call this at application startup
 */
export function assertEnvironmentValid(): void {
  const isDev = process.env.NODE_ENV === "development";
  const result = validateEnvironment(isDev);

  if (!result.isValid) {
    const errorMessage = [
      "❌ ENVIRONMENT VALIDATION FAILED",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      ...result.errors,
      "",
      "Please set the required environment variables and restart.",
      "See .env.example for reference.",
    ].join("\n");

    console.error(errorMessage);
    throw new Error("Environment validation failed. Cannot start application.");
  }

  if (result.warnings.length > 0) {
    const warningMessage = [
      "⚠️  ENVIRONMENT WARNINGS",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      ...result.warnings,
    ].join("\n");

    console.warn(warningMessage);
  }
}

/**
 * Get validated environment variables with fallbacks
 */
export function getEnv() {
  return {
    // Core
    isDevelopment: process.env.NODE_ENV === "development",
    nodeEnv: process.env.NODE_ENV || "development",

    // Convex
    convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL || "",

    // AI Models
    nvidiaApiKey: process.env.NVIDIA_API_KEY || "",
    openrouterApiKey: process.env.OPENROUTER_API_KEY || "",
    openaiApiKey: process.env.OPENAI_API_KEY || "",
    perplexityApiKey: process.env.PERPLEXITY_API_KEY || "",

    // Knowledge Graph
    neo4jUri: process.env.NEO4J_URI || "bolt://localhost:7687",
    neo4jUser: process.env.NEO4J_USER || "neo4j",
    neo4jPassword: process.env.NEO4J_PASSWORD || "",

    // Vector Search
    qdrantUrl: process.env.QDRANT_URL || "http://localhost:6333",
    qdrantApiKey: process.env.QDRANT_API_KEY || "",

    // E2B Sandbox
    e2bApiKey: process.env.E2B_API_KEY || "",

    // External Services
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
    workosApiKey: process.env.WORKOS_API_KEY || "",

    // Agent Configuration
    hitlApprovalTimeoutMs: parseInt(process.env.HITL_APPROVAL_TIMEOUT_MS || "1800000"), // 30min default
    maxCoordinatorIterations: parseInt(process.env.MAX_COORDINATOR_ITERATIONS || "48"),
  };
}
