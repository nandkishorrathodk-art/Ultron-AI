/**
 * Local Sandbox Manager
 * ═══════════════════════════════════════════════════════════════
 * In-memory connection store and command dispatcher for the
 * direct local-sandbox mode (no Convex/Centrifugo required).
 *
 * Flow:
 *   1. CLI POSTs /api/sandbox/local/connect  → gets connectionId
 *   2. CLI opens SSE  /api/sandbox/local/stream → receives commands
 *   3. Chat route calls executeOnLocal(connectionId, command)
 *   4. Command is pushed to SSE stream → CLI executes
 *   5. CLI POSTs /api/sandbox/local/result   → resolves promise
 * ═══════════════════════════════════════════════════════════════
 */

import { randomUUID, randomBytes } from "crypto";
import { EventEmitter } from "events";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LocalConnection {
  connectionId: string;
  name: string;
  token: string;
  osInfo?: {
    platform: string;
    arch: string;
    release: string;
    hostname: string;
  };
  capabilities?: { commands: boolean; pty: boolean };
  connectedAt: number;
  lastActivity: number;
  isDesktop: boolean;
  /** SSE stream is attached and can receive commands */
  streamReady: boolean;
}

export interface PendingCommand {
  commandId: string;
  command: string;
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  resolve: (result: CommandResult) => void;
  reject: (err: Error) => void;
  timer?: ReturnType<typeof setTimeout>;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

// ---------------------------------------------------------------------------
// Singleton manager
// ---------------------------------------------------------------------------

class LocalSandboxManager extends EventEmitter {
  private connections = new Map<string, LocalConnection>();
  private pendingCommands = new Map<string, PendingCommand>();
  private sandboxToken: string | null = null;

  constructor() {
    super();
    this.setMaxListeners(50);
    // Clean stale connections every 2 minutes
    const interval = setInterval(() => this.sweepStale(), 2 * 60_000);
    interval.unref();
  }

  // -----------------------------------------------------------------------
  // Token management (simple shared token for direct mode)
  // -----------------------------------------------------------------------

  getSandboxToken(): string {
    if (!this.sandboxToken) {
      this.sandboxToken =
        process.env.LOCAL_SANDBOX_TOKEN ||
        `lsb_${randomBytes(24).toString("hex")}`;
    }
    return this.sandboxToken;
  }

  validateToken(token: string): boolean {
    return token === this.getSandboxToken();
  }

  // -----------------------------------------------------------------------
  // Connection lifecycle
  // -----------------------------------------------------------------------

  register(
    token: string,
    name: string,
    osInfo?: LocalConnection["osInfo"],
    capabilities?: LocalConnection["capabilities"],
  ): LocalConnection | null {
    if (!this.validateToken(token)) return null;

    const connectionId = randomUUID();
    const conn: LocalConnection = {
      connectionId,
      name,
      token,
      osInfo,
      capabilities,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      isDesktop: true,
      streamReady: false,
    };
    this.connections.set(connectionId, conn);
    return conn;
  }

  disconnect(connectionId: string): boolean {
    const conn = this.connections.get(connectionId);
    if (!conn) return false;
    this.connections.delete(connectionId);
    // Reject any pending commands for this connection
    for (const [cmdId, pending] of this.pendingCommands) {
      if (cmdId.startsWith(connectionId)) {
        if (pending.timer) clearTimeout(pending.timer);
        pending.reject(new Error("Connection disconnected"));
        this.pendingCommands.delete(cmdId);
      }
    }
    this.emit(`disconnect:${connectionId}`);
    return true;
  }

  markStreamReady(connectionId: string): void {
    const conn = this.connections.get(connectionId);
    if (conn) {
      conn.streamReady = true;
      conn.lastActivity = Date.now();
    }
  }

  markStreamClosed(connectionId: string): void {
    const conn = this.connections.get(connectionId);
    if (conn) {
      conn.streamReady = false;
    }
  }

  getConnection(connectionId: string): LocalConnection | undefined {
    return this.connections.get(connectionId);
  }

  listConnections(): LocalConnection[] {
    return Array.from(this.connections.values());
  }

  /** Find a connection that has an active SSE stream */
  findReadyConnection(): LocalConnection | undefined {
    for (const conn of this.connections.values()) {
      if (conn.streamReady) return conn;
    }
    return undefined;
  }

  // -----------------------------------------------------------------------
  // Command dispatch
  // -----------------------------------------------------------------------

  /**
   * Execute a command on a local sandbox connection.
   * Returns a promise that resolves when the CLI sends the result.
   */
  executeCommand(
    connectionId: string,
    command: string,
    options: {
      cwd?: string;
      env?: Record<string, string>;
      timeout?: number;
    } = {},
  ): Promise<CommandResult> {
    const conn = this.connections.get(connectionId);
    if (!conn) {
      return Promise.reject(new Error("Connection not found"));
    }
    if (!conn.streamReady) {
      return Promise.reject(new Error("Connection stream not ready"));
    }

    const commandId = randomUUID();
    const timeout = options.timeout ?? 30_000;

    return new Promise<CommandResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingCommands.delete(commandId);
        reject(new Error(`Command timed out after ${timeout}ms`));
      }, timeout + 5_000); // Extra 5s grace for network overhead

      const pending: PendingCommand = {
        commandId,
        command,
        cwd: options.cwd,
        env: options.env,
        timeout,
        resolve,
        reject,
        timer,
      };

      this.pendingCommands.set(commandId, pending);
      conn.lastActivity = Date.now();

      // Emit the command to the SSE stream handler
      this.emit(`command:${connectionId}`, {
        type: "command",
        commandId,
        command,
        cwd: options.cwd,
        env: options.env,
        timeout,
        targetConnectionId: connectionId,
      });
    });
  }

  /**
   * Called when CLI submits command result.
   */
  submitResult(commandId: string, result: CommandResult): boolean {
    const pending = this.pendingCommands.get(commandId);
    if (!pending) return false;

    if (pending.timer) clearTimeout(pending.timer);
    this.pendingCommands.delete(commandId);
    pending.resolve(result);
    return true;
  }

  // -----------------------------------------------------------------------
  // Maintenance
  // -----------------------------------------------------------------------

  private sweepStale(): void {
    const now = Date.now();
    const staleMs = 10 * 60_000; // 10 minutes without activity
    for (const [id, conn] of this.connections) {
      if (!conn.streamReady && now - conn.lastActivity > staleMs) {
        this.disconnect(id);
      }
    }
  }
}

// Singleton — use globalThis to survive module re-evaluation in dev mode
const globalKey = "__ultron_local_sandbox_manager__" as const;
const g = globalThis as unknown as Record<string, LocalSandboxManager>;
export const localSandboxManager: LocalSandboxManager =
  g[globalKey] ?? (g[globalKey] = new LocalSandboxManager());
