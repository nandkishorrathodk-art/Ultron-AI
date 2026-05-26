/**
 * ULTRON v3.0 — Sandbox Manager
 *
 * Manages persistent E2B sandbox sessions.
 * NOTE: In-memory Map works for long-lived Node processes (e.g. `next dev`,
 * custom server, Docker). For serverless (Vercel), consider using Redis/Upstash
 * to store sandbox IDs and reconnect via `Sandbox.connect(sandboxId)`.
 */

import { Sandbox } from "e2b";

interface SandboxLog {
  command: string;
  output: string;
  timestamp: number;
}

interface SandboxSession {
  sandbox: Sandbox;
  sessionId: string;
  sandboxId: string;
  lastUsed: number;
  logs: SandboxLog[];
}

// In-memory session store — works for persistent Node servers
const sandboxSessions = new Map<string, SandboxSession>();

const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const CLEANUP_INTERVAL_MS = 60_000;

// Cleanup runs only in long-lived processes (not serverless)
let cleanupStarted = false;

function startCleanupIfNeeded(): void {
  if (cleanupStarted || typeof globalThis.setInterval === "undefined") return;
  cleanupStarted = true;

  const interval = setInterval(async () => {
    const now = Date.now();
    for (const [sid, session] of sandboxSessions) {
      if (now - session.lastUsed > IDLE_TIMEOUT_MS) {
        console.log(`[Sandbox] Killing idle sandbox: ${sid}`);
        try {
          await session.sandbox.kill();
        } catch {
          // sandbox may already be dead
        }
        sandboxSessions.delete(sid);
      }
    }
  }, CLEANUP_INTERVAL_MS);

  // Don't prevent Node from exiting
  if (interval.unref) interval.unref();
}

export async function getOrCreateSandbox(sessionId: string): Promise<Sandbox> {
  const existing = sandboxSessions.get(sessionId);
  if (existing) {
    existing.lastUsed = Date.now();
    return existing.sandbox;
  }

  console.log(`[Sandbox] Creating new sandbox for session: ${sessionId}`);

  const sandbox = await Sandbox.create({
    apiKey: process.env.E2B_API_KEY,
    timeoutMs: 5 * 60 * 1000, // 5 minutes sandbox lifetime
  });

  // Bootstrap the workspace
  await sandbox.commands.run(
    "mkdir -p /home/user/pentest && echo '# Ultron v3.0 Findings' > /home/user/pentest/findings.md",
    { timeoutMs: 5_000 },
  );

  sandboxSessions.set(sessionId, {
    sandbox,
    sessionId,
    sandboxId: sandbox.sandboxId,
    lastUsed: Date.now(),
    logs: [],
  });

  startCleanupIfNeeded();

  return sandbox;
}

export async function killSandbox(sessionId: string): Promise<boolean> {
  const session = sandboxSessions.get(sessionId);
  if (!session) return false;

  try {
    await session.sandbox.kill();
  } catch {
    // sandbox may already be dead
  }
  sandboxSessions.delete(sessionId);
  console.log(`[Sandbox] Killed sandbox for session: ${sessionId}`);
  return true;
}

export function addSandboxLog(sessionId: string, command: string, output: string): void {
  const session = sandboxSessions.get(sessionId);
  if (session) {
    session.logs.push({ command, output, timestamp: Date.now() });
    session.lastUsed = Date.now();
  }
}

export function getActiveSandboxes(): Array<{
  sessionId: string;
  sandboxId: string;
  ageSeconds: number;
  logCount: number;
  logs: SandboxLog[];
}> {
  const now = Date.now();
  return Array.from(sandboxSessions.values()).map((s) => ({
    sessionId: s.sessionId,
    sandboxId: s.sandboxId,
    ageSeconds: Math.round((now - s.lastUsed) / 1000),
    logCount: s.logs.length,
    logs: s.logs.slice(-50),
  }));
}
