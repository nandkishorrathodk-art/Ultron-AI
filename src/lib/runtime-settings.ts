/**
 * Shared runtime settings store.
 * Allows persisting overrides in memory at runtime across different API routes.
 */

export interface UltronSettings {
  llmBaseUrl: string;
  llmModel: string;
  llmApiKey: string;
  e2bApiKey: string;
}

if (!(global as any).ultronSettings) {
  (global as any).ultronSettings = {
    llmBaseUrl: process.env.LLM_BASE_URL || "https://integrate.api.nvidia.com/v1",
    llmModel: process.env.LLM_MODEL || "meta/llama-3.1-70b-instruct",
    llmApiKey: process.env.LLM_API_KEY || "",
    e2bApiKey: process.env.E2B_API_KEY || "",
  };
}

export const runtimeSettings: UltronSettings = (global as any).ultronSettings;

export function updateRuntimeSettings(updates: Partial<UltronSettings>) {
  Object.assign(runtimeSettings, updates);
  
  // Also push to environment variables if provided, so external libraries like E2B or OpenAI SDK read them
  if (updates.e2bApiKey) {
    process.env.E2B_API_KEY = updates.e2bApiKey;
  }
  if (updates.llmApiKey) {
    process.env.LLM_API_KEY = updates.llmApiKey;
  }
  if (updates.llmBaseUrl) {
    process.env.LLM_BASE_URL = updates.llmBaseUrl;
  }
  if (updates.llmModel) {
    process.env.LLM_MODEL = updates.llmModel;
  }
}
