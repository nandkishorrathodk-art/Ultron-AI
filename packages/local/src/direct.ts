/**
 * Direct Connection Mode
 * ═══════════════════════════════════════════════════════════════
 * Connects the local sandbox CLI directly to the Next.js app
 * via HTTP + SSE, bypassing Convex and Centrifugo.
 *
 * Usage:
 *   npx @ultron-ai/local --direct http://localhost:3000 --token TOKEN
 * ═══════════════════════════════════════════════════════════════
 */

import { spawn, ChildProcess } from "child_process";
import os from "os";
import http from "http";
import https from "https";
import {
  truncateOutput,
  MAX_OUTPUT_SIZE,
  getDefaultShell,
  buildShellSpawn,
} from "./utils.js";

const DEFAULT_SHELL = getDefaultShell(os.platform());

const chalk = {
  blue: (s: string) => `\x1b[34m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  gray: (s: string) => `\x1b[90m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

interface DirectConfig {
  serverUrl: string;
  token: string;
  name: string;
}

interface CommandMessage {
  type: "command";
  commandId: string;
  command: string;
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  targetConnectionId: string;
}

function httpRequest(
  url: string,
  options: {
    method: string;
    headers?: Record<string, string>;
    body?: string;
  },
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === "https:" ? https : http;

    const req = mod.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: options.method,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => (data += chunk.toString()));
        res.on("end", () =>
          resolve({ status: res.statusCode ?? 0, body: data }),
        );
      },
    );
    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

export class DirectSandboxClient {
  private connectionId: string | null = null;
  private isShuttingDown = false;
  private activeCommands = new Map<string, ChildProcess>();
  private sseRequest: http.ClientRequest | null = null;

  constructor(private config: DirectConfig) {}

  async start(): Promise<void> {
    console.log(
      chalk.blue("🚀 Starting Ultron-AI local sandbox (direct mode)..."),
    );
    console.log(
      chalk.yellow(
        "⚠️  Commands run directly on your OS without any isolation.",
      ),
    );
    console.log(chalk.gray(`Server: ${this.config.serverUrl}`));

    await this.connect();
  }

  private async connect(): Promise<void> {
    console.log(chalk.blue("Connecting to Ultron-AI..."));

    try {
      const resp = await httpRequest(
        `${this.config.serverUrl}/api/sandbox/local/connect`,
        {
          method: "POST",
          body: JSON.stringify({
            token: this.config.token,
            name: this.config.name,
            osInfo: {
              platform: os.platform(),
              arch: os.arch(),
              release: os.release(),
              hostname: os.hostname(),
            },
            capabilities: { commands: true, pty: false },
          }),
        },
      );

      const data = JSON.parse(resp.body);
      if (!data.success) {
        throw new Error(data.error || "Connection failed");
      }

      this.connectionId = data.connectionId;
      console.log(chalk.green("✓ Authenticated"));
      console.log(chalk.gray(`Connection: ${this.connectionId}`));

      this.openSSEStream();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(chalk.red("❌ Connection failed:"), msg);
      process.exit(1);
    }
  }

  private openSSEStream(): void {
    if (!this.connectionId) return;

    const url = new URL(
      `/api/sandbox/local/stream?connectionId=${this.connectionId}&token=${encodeURIComponent(this.config.token)}`,
      this.config.serverUrl,
    );

    const mod = url.protocol === "https:" ? https : http;

    const makeRequest = () => {
      const req = mod.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname + url.search,
          method: "GET",
          headers: { Accept: "text/event-stream" },
        },
        (res) => {
          if (res.statusCode !== 200) {
            console.error(
              chalk.red(`❌ SSE stream returned ${res.statusCode}`),
            );
            // Retry after delay
            setTimeout(() => {
              if (!this.isShuttingDown) makeRequest();
            }, 3000);
            return;
          }

          let buffer = "";
          res.on("data", (chunk: Buffer) => {
            buffer += chunk.toString();
            const lines = buffer.split("\n\n");
            buffer = lines.pop() ?? "";

            for (const block of lines) {
              const dataLine = block
                .split("\n")
                .find((l) => l.startsWith("data: "));
              if (!dataLine) continue;

              try {
                const msg = JSON.parse(dataLine.slice(6));
                this.handleMessage(msg);
              } catch {
                // Ignore malformed SSE messages
              }
            }
          });

          res.on("end", () => {
            if (!this.isShuttingDown) {
              console.log(
                chalk.yellow("⚠️  SSE stream ended, reconnecting..."),
              );
              setTimeout(() => makeRequest(), 2000);
            }
          });

          res.on("error", (err: Error) => {
            if (!this.isShuttingDown) {
              console.error(chalk.red("SSE error:"), err.message);
              setTimeout(() => makeRequest(), 3000);
            }
          });
        },
      );

      req.on("error", (err: Error) => {
        if (!this.isShuttingDown) {
          console.error(chalk.red("SSE connection error:"), err.message);
          setTimeout(() => makeRequest(), 3000);
        }
      });

      req.end();
      this.sseRequest = req;
    };

    makeRequest();
  }

  private handleMessage(msg: { type: string; [key: string]: unknown }): void {
    switch (msg.type) {
      case "connected":
        console.log(chalk.bold(chalk.green("🎉 Local sandbox is ready!")));
        console.log(chalk.gray("Waiting for commands from Ultron-AI..."));
        break;

      case "command":
        this.executeCommand(msg as unknown as CommandMessage).catch(
          (err: Error) => {
            console.error(chalk.red("Command execution error:"), err.message);
          },
        );
        break;

      default:
        break;
    }
  }

  private async executeCommand(msg: CommandMessage): Promise<void> {
    const { commandId, command, cwd, env, timeout = 30000 } = msg;

    console.log(chalk.cyan(`▶ ${command}`));

    try {
      let fullCommand = command;

      const shellBase =
        DEFAULT_SHELL.shell
          .toLowerCase()
          .replace(/\\/g, "/")
          .split("/")
          .pop() ?? "";
      const useCmd = shellBase === "cmd" || shellBase === "cmd.exe";

      if (cwd && cwd.trim() !== "") {
        fullCommand = useCmd
          ? `cd /d "${cwd}" && ${fullCommand}`
          : `cd "${cwd}" 2>/dev/null && ${fullCommand}`;
      }

      if (env) {
        const envString = Object.entries(env)
          .map(([k, v]) => {
            if (useCmd) {
              const escaped = v.replace(/%/g, "%%").replace(/"/g, '""');
              return `set "${k}=${escaped}"`;
            }
            const escaped = v
              .replace(/\\/g, "\\\\")
              .replace(/"/g, '\\"')
              .replace(/\$/g, "\\$")
              .replace(/`/g, "\\`");
            return `export ${k}="${escaped}"`;
          })
          .join(useCmd ? " && " : "; ");
        fullCommand = useCmd
          ? `${envString} && ${fullCommand}`
          : `${envString}; ${fullCommand}`;
      }

      const result = await this.runCommand(commandId, fullCommand, timeout);

      console.log(
        result.exitCode === 0
          ? chalk.green(`✓ ${command}`)
          : chalk.red(`✗ ${command} (exit ${result.exitCode})`),
      );

      // Submit result
      await httpRequest(`${this.config.serverUrl}/api/sandbox/local/result`, {
        method: "POST",
        body: JSON.stringify({
          commandId,
          token: this.config.token,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
        }),
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`✗ ${command}: ${errMsg}`));

      await httpRequest(`${this.config.serverUrl}/api/sandbox/local/result`, {
        method: "POST",
        body: JSON.stringify({
          commandId,
          token: this.config.token,
          stdout: "",
          stderr: errMsg,
          exitCode: 1,
        }),
      }).catch(() => {});
    }
  }

  private runCommand(
    commandId: string,
    fullCommand: string,
    timeout: number,
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve) => {
      let stdout = "";
      let stderr = "";
      let killed = false;

      const spawnSpec = buildShellSpawn(
        DEFAULT_SHELL.shell,
        DEFAULT_SHELL.shellFlag,
        fullCommand,
      );
      const proc = spawn(DEFAULT_SHELL.shell, spawnSpec.args, {
        stdio: ["ignore", "pipe", "pipe"],
        detached: os.platform() !== "win32",
        ...spawnSpec.options,
      });
      this.activeCommands.set(commandId, proc);

      const timeoutId = setTimeout(() => {
        killed = true;
        try {
          if (proc.pid && os.platform() !== "win32") {
            process.kill(-proc.pid, "SIGTERM");
          } else {
            proc.kill("SIGTERM");
          }
        } catch {
          proc.kill("SIGKILL");
        }
      }, timeout);

      proc.stdout?.on("data", (data: Buffer) => {
        stdout += data.toString();
        if (stdout.length > MAX_OUTPUT_SIZE * 2) {
          stdout = truncateOutput(stdout, MAX_OUTPUT_SIZE * 2);
        }
      });

      proc.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString();
        if (stderr.length > MAX_OUTPUT_SIZE * 2) {
          stderr = truncateOutput(stderr, MAX_OUTPUT_SIZE * 2);
        }
      });

      proc.on("close", (code) => {
        clearTimeout(timeoutId);
        this.activeCommands.delete(commandId);
        resolve({
          stdout: truncateOutput(stdout, MAX_OUTPUT_SIZE),
          stderr: truncateOutput(
            killed ? stderr + "\n[Command timed out]" : stderr,
            MAX_OUTPUT_SIZE,
          ),
          exitCode: killed ? 124 : (code ?? 1),
        });
      });

      proc.on("error", (error) => {
        clearTimeout(timeoutId);
        this.activeCommands.delete(commandId);
        resolve({
          stdout: truncateOutput(stdout, MAX_OUTPUT_SIZE),
          stderr: truncateOutput(
            stderr + "\n" + error.message,
            MAX_OUTPUT_SIZE,
          ),
          exitCode: 1,
        });
      });
    });
  }

  async cleanup(): Promise<void> {
    console.log(chalk.blue("\n🧹 Cleaning up..."));
    this.isShuttingDown = true;

    // Kill active commands
    for (const [, proc] of this.activeCommands) {
      try {
        proc.kill("SIGTERM");
      } catch {
        // ignore
      }
    }
    this.activeCommands.clear();

    // Close SSE stream
    if (this.sseRequest) {
      this.sseRequest.destroy();
      this.sseRequest = null;
    }

    // Notify server
    if (this.connectionId) {
      await httpRequest(`${this.config.serverUrl}/api/sandbox/local/connect`, {
        method: "DELETE",
        body: JSON.stringify({
          connectionId: this.connectionId,
          token: this.config.token,
        }),
      }).catch(() => {});
    }

    console.log(chalk.green("✓ Disconnected"));
  }
}
