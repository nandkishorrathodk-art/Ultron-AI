/**
 * ULTRON v2.0 — Model Roster & Fallback Chain
 * Per-agent LLM assignment with runtime switching support.
 *
 * Based on PentAGI v1.2 GitHub (April 2026) production-tested models.
 */

export type AgentRole =
  | "orchestrator"
  | "researcher"
  | "developer"
  | "executor"
  | "web_agent"
  | "browser_agent"
  | "privesc_agent"
  | "llm_rt_agent"
  | "report_agent"
  | "recon_agent"
  | "vuln_agent"
  | "exploit_agent"
  | "post_exploit_agent"
  | "local_model"
  | "fast_model"
  | "filter_model";

export const MODEL_ROSTER: Record<AgentRole, string> = {
  // Complex reasoning agents
  orchestrator: "anthropic/claude-sonnet-4-6",
  researcher: "google/gemini-3.1-pro-preview",
  developer: "anthropic/claude-sonnet-4-6",

  // Execution agents (tool calling, speed)
  executor: "moonshotai/kimi-k2.6",
  web_agent: "google/gemini-3.1-flash-preview",
  browser_agent: "anthropic/claude-sonnet-4-6",

  // Specialist agents
  recon_agent: "google/gemini-3.1-flash-preview",
  vuln_agent: "anthropic/claude-sonnet-4-6",
  exploit_agent: "anthropic/claude-sonnet-4-6",
  post_exploit_agent: "anthropic/claude-sonnet-4-6",
  privesc_agent: "anthropic/claude-sonnet-4-6",
  llm_rt_agent: "anthropic/claude-opus-4-6",
  report_agent: "google/gemini-3.1-flash-preview",

  // Utility models
  local_model: "ollama/qwen3.5-27b",
  fast_model: "x-ai/grok-4.1-fast",
  filter_model: "deepseek/deepseek-v4-flash",
};

export interface ModelConfig {
  label: string;
  baseURL: string;
  apiKey: string;
  model: string;
}

export function getModelChain(): ModelConfig[] {
  return [
    {
      label: "Primary (Nvidia NIM)",
      baseURL: process.env.LLM_BASE_URL ?? "https://integrate.api.nvidia.com/v1",
      apiKey: process.env.LLM_API_KEY ?? "",
      model: process.env.LLM_MODEL ?? "meta/llama-3.1-405b-instruct",
    },
    {
      label: "Fallback (OpenRouter / Claude Sonnet 4.6)",
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY ?? "",
      model: MODEL_ROSTER.orchestrator,
    },
    {
      label: "Emergency (OpenRouter / Llama 70B)",
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY ?? "",
      model: "meta-llama/llama-3.1-70b-instruct",
    },
  ];
}

/**
 * Get the model config for a specific agent role.
 * Falls back to OpenRouter if direct provider key is not available.
 */
export function getModelForAgent(role: AgentRole): ModelConfig {
  const model = MODEL_ROSTER[role];

  // Direct Anthropic
  if (model.startsWith("anthropic/") && process.env.ANTHROPIC_API_KEY) {
    return {
      label: `${role} (Anthropic Direct)`,
      baseURL: "https://api.anthropic.com/v1",
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: model.replace("anthropic/", ""),
    };
  }

  // Direct Google
  if (model.startsWith("google/") && process.env.GOOGLE_AI_API_KEY) {
    return {
      label: `${role} (Google Direct)`,
      baseURL: "https://generativelanguage.googleapis.com/v1beta",
      apiKey: process.env.GOOGLE_AI_API_KEY,
      model: model.replace("google/", ""),
    };
  }

  // Local Ollama
  if (model.startsWith("ollama/") && process.env.OLLAMA_BASE_URL) {
    return {
      label: `${role} (Ollama Local)`,
      baseURL: process.env.OLLAMA_BASE_URL,
      apiKey: "ollama",
      model: model.replace("ollama/", ""),
    };
  }

  // Fallback: OpenRouter (supports all models)
  return {
    label: `${role} (OpenRouter)`,
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY ?? "",
    model,
  };
}
