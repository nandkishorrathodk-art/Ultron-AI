/**
 * Shared Sandbox Session Manager
 * ═══════════════════════════════════════════════════════════════
 * Extracted from chat/route.ts so both the chat route and the
 * execute-approved route can reuse the SAME persistent sandbox.
 *
 * Key design: one VM per session, files/tools survive between commands.
 * Supports both E2B Cloud and Direct Local sandbox modes.
 * ═══════════════════════════════════════════════════════════════
 */

import { Sandbox } from "e2b";
import { localSandboxManager } from "@/lib/local-sandbox-manager";

// ─── Sandbox Session Interface ────────────────────────────────────────────────
interface SandboxSession {
  sandbox: Sandbox;
  lastUsed: number;
  logs: { command: string; output: string; timestamp: number }[];
}

// ─── Sandbox Session Map ──────────────────────────────────────────────────────
// Stores active sandbox instances keyed by sessionId.
const sandboxSessions = new Map<string, SandboxSession>();

// Clean up idle sandboxes older than 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sandboxSessions.entries()) {
    if (now - session.lastUsed > 10 * 60 * 1000) {
      session.sandbox.kill().catch(() => {});
      sandboxSessions.delete(id);
      console.log(`[Ultron] Session ${id} expired and cleaned up`);
    }
  }
}, 60_000);

// ─── Get or Create Sandbox ────────────────────────────────────────────────────
export async function getOrCreateSandbox(
  sessionId: string,
  template?: string,
): Promise<Sandbox> {
  const existing = sandboxSessions.get(sessionId);
  if (existing) {
    existing.lastUsed = Date.now();
    console.log(`[Ultron] Reusing sandbox for session: ${sessionId}`);
    return existing.sandbox;
  }

  console.log(
    `[Ultron] Creating new sandbox for session: ${sessionId}${template ? ` with template: ${template}` : ""}`,
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const options: any = { apiKey: process.env.E2B_API_KEY! };
  if (template) {
    options.template = template;
  }
  const sandbox = await Sandbox.create(options);

  // Bootstrap pentest workspace on first creation
  await sandbox.commands.run(
    "mkdir -p /home/user/pentest && " +
      "echo '# Ultron Pentest Session' > /home/user/pentest/findings.md && " +
      "echo 'Session started: ' $(date) >> /home/user/pentest/findings.md",
  );

  sandboxSessions.set(sessionId, { sandbox, lastUsed: Date.now(), logs: [] });
  return sandbox;
}

// ─── Get Desktop Stream URL ──────────────────────────────────────────────────
export function getDesktopStreamUrl(sessionId: string): string | null {
  const session = sandboxSessions.get(sessionId);
  if (!session) return null;
  try {
    // E2B desktop template exposes noVNC on port 6080
    return `https://${session.sandbox.getHost(6080)}`;
  } catch (err) {
    console.error("[Ultron] Error getting desktop stream URL:", err);
    return null;
  }
}

// ─── Kill Sandbox ─────────────────────────────────────────────────────────────
export async function killSandbox(sessionId: string): Promise<boolean> {
  const session = sandboxSessions.get(sessionId);
  if (session) {
    await session.sandbox.kill().catch(() => {});
    sandboxSessions.delete(sessionId);
    return true;
  }
  return false;
}

// ─── Add Sandbox Execution Log ───────────────────────────────────────────────
export function addSandboxLog(
  sessionId: string,
  command: string,
  output: string,
) {
  const session = sandboxSessions.get(sessionId);
  if (session) {
    session.logs.push({
      command,
      output: output || "(no output)",
      timestamp: Date.now(),
    });
    session.lastUsed = Date.now();
  }
}

// ─── Get Active Sandboxes ─────────────────────────────────────────────────────
export function getActiveSandboxes() {
  const active = [];
  const now = Date.now();
  for (const [id, session] of sandboxSessions.entries()) {
    active.push({
      sessionId: id,
      sandboxId: session.sandbox.sandboxId,
      ageSeconds: Math.floor((now - session.lastUsed) / 1000),
      logs: session.logs,
    });
  }
  return active;
}

// ─── Local Sandbox Execution ─────────────────────────────────────────────────
// Provides an E2B-like interface for local sandbox command execution.

export interface LocalExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Execute a command on a connected local sandbox.
 * Finds the first ready connection and dispatches the command.
 */
export async function executeOnLocalSandbox(
  command: string,
  options: { connectionId?: string; timeoutMs?: number } = {},
): Promise<LocalExecResult> {
  const { connectionId, timeoutMs = 30_000 } = options;

  let conn;
  if (connectionId && connectionId !== "desktop") {
    conn = localSandboxManager.getConnection(connectionId);
  } else {
    conn = localSandboxManager.findReadyConnection();
  }

  if (!conn) {
    throw new Error(
      "No local sandbox connected. Run: npx @ultron-ai/local --direct http://localhost:3000 --token TOKEN",
    );
  }

  return localSandboxManager.executeCommand(conn.connectionId, command, {
    timeout: timeoutMs,
  });
}

/**
 * Check if any local sandbox connection is available.
 */
export function hasLocalSandbox(connectionId?: string): boolean {
  if (connectionId && connectionId !== "desktop") {
    const conn = localSandboxManager.getConnection(connectionId);
    return !!conn?.streamReady;
  }
  return !!localSandboxManager.findReadyConnection();
}
