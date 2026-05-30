/* eslint-disable @typescript-eslint/no-explicit-any, prefer-const */
/**
 * Autonomous Pentest Coordinator System (THE BRAIN)
 * ═══════════════════════════════════════════════════════════════
 * The central orchestrator that replaces standard chatbot loop
 * with a stateful, parallel, multi-agent execution loop.
 *
 * Lifecycle:
 *  1. Instantiates PTG from target scope and attack mode
 *  2. Executes main loop:
 *     - Selects next task via LLM reasoning
 *     - Gathers CVE/mitre context via Intelligence RAG
 *     - Generates exact command with bypass strategies
 *     - Checks HITL gates (red risk level)
 *     - Runs command inside persistent sandbox
 *     - Parses structured findings
 *     - Validates deterministically (plausibility is NOT proof)
 *     - Checks for attack chains
 *     - Commits findings to 4-tier memory
 *     - Spawns child tasks from findings
 *  3. Syncs real-time progress to Convex and reports via callback
 * ═══════════════════════════════════════════════════════════════
 */

import { PenetrationTaskGraph, PTGNode, Finding } from "./ptg";
import { buildTemplate, spawnTasksFromFinding } from "./task-templates";
import { decideNextTask, analyzeFailure } from "./modules/reasoning";
import { gatherIntelligence } from "./modules/intelligence";
import { generateCommand } from "./modules/generation";
import { parseOutput } from "./modules/parsing";
import { validateFindings } from "./modules/validator";
import { detectChains } from "./modules/chainer";
import { storeMemory } from "./modules/memory";
import { getOrCreateSandbox } from "../sandbox-manager";
import { FailedAttempt } from "./strategies";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import {
  addWorklogEntry,
  addShellEntry,
  trackFileChange,
  trackIDEFile,
  spawnAgentSession,
  updateAgentSession,
} from "../session-tracker";

const convexUrl =
  process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL || "";
const convexClient = convexUrl ? new ConvexHttpClient(convexUrl) : null;

export interface CoordinatorOptions {
  sessionId: string;
  targetScope: string[];
  mode: "standard" | "ctf" | "bug_bounty" | "continuous";
  maxIterations?: number;
  onProgress?: (update: CoordinatorProgressUpdate) => void;
}

export interface CoordinatorProgressUpdate {
  type:
    | "status"
    | "task_start"
    | "task_complete"
    | "task_fail"
    | "hitl_waiting"
    | "hitl_resume"
    | "chain_detected";
  message: string;
  taskId?: string;
  taskTitle?: string;
  findingsCount?: number;
  ptgStats?: any;
  currentPtg?: any;
}

export class PentestCoordinator {
  private sessionId: string;
  private targetScope: string[];
  private mode: "standard" | "ctf" | "bug_bounty" | "continuous";
  private maxIterations: number;
  private onProgress?: (update: CoordinatorProgressUpdate) => void;

  private ptg: PenetrationTaskGraph;
  private failedAttemptsHistory: FailedAttempt[] = [];
  private iterations = 0;
  private isRunning = false;

  constructor(options: CoordinatorOptions) {
    this.sessionId = options.sessionId;
    this.targetScope = options.targetScope;
    this.mode = options.mode;
    this.maxIterations = options.maxIterations || 48; // XBOW-level 48-step chains support
    this.onProgress = options.onProgress;

    this.ptg = new PenetrationTaskGraph();
  }

  /**
   * Run the complete autonomous pentesting loop.
   */
  async run(): Promise<PenetrationTaskGraph> {
    if (this.isRunning) {
      throw new Error("Coordinator is already running");
    }
    this.isRunning = true;
    this.iterations = 0;

    this.emit(
      "status",
      `Initializing autonomous session for target(s): ${this.targetScope.join(", ")}`,
    );
    addWorklogEntry(
      this.sessionId,
      "flow_start",
      `Autonomous XBOW-Class Pentest Started on ${this.targetScope.join(", ")}`,
      "running",
    );

    // 1. Initialize PTG from template
    for (const target of this.targetScope) {
      const templateNodes = buildTemplate(target, this.mode);
      this.ptg.addNodes(templateNodes);
    }

    // Sync initial state to Convex
    await this.syncState("active");
    this.emit("status", "Attack plan constructed successfully");
    addWorklogEntry(
      this.sessionId,
      "flow_start",
      "Attack plan constructed successfully",
      "success",
    );

    try {
      // 2. Core Autonomous Loop
      while (
        this.ptg.hasActiveTasks() &&
        !this.ptg.isComplete() &&
        this.iterations < this.maxIterations
      ) {
        this.iterations++;
        this.emit(
          "status",
          `Step ${this.iterations}/${this.maxIterations}: Selecting next optimal action`,
        );

        // A. Select next task via LLM reasoning
        const context = {
          currentFindings: this.ptg.getAllFindings(),
          failedAttempts: this.failedAttemptsHistory,
          sessionMode: this.mode,
        };

        const decision = await decideNextTask(this.ptg, context);

        if (!decision) {
          this.emit("status", "No more executable tasks ready at this moment.");
          break;
        }

        const { task, strategy } = decision;

        // B. Start task
        this.ptg.startTask(task.task_id);
        await this.syncState("active");
        addWorklogEntry(
          this.sessionId,
          "command",
          `Starting task: ${task.title}`,
          "running",
        );
        this.emit(
          "task_start",
          `Starting task: "${task.title}"`,
          task.task_id,
          task.title,
        );

        // C. Log action to audit trail
        await this.logAudit("tool_invocation", {
          taskId: task.task_id,
          taskTitle: task.title,
          phase: task.phase,
          strategy: strategy.description,
        });

        // D. Gather intelligence context via RAG
        const serviceInfo = `${task.title} (phase: ${task.phase})`;
        const intel = await gatherIntelligence(serviceInfo, {
          phase: task.phase,
          sessionId: this.sessionId,
          hostIp: this.targetScope[0],
        });

        // E. Generate exact command with potential evasion
        const generated = await generateCommand(task, intel, strategy);
        let finalCommand = generated.command;

        // F. Handle HITL Gate for high-risk operations
        if (generated.riskLevel === "red") {
          this.emit(
            "hitl_waiting",
            `Task requires Human Approval (High Risk): ${task.title}`,
            task.task_id,
            task.title,
          );

          if (convexClient) {
            try {
              const approvalId = await convexClient.mutation(
                api.hitl.requestApproval,
                {
                  sessionId: this.sessionId as any,
                  taskId: task.task_id,
                  riskLevel: "red",
                  command: finalCommand,
                  justification:
                    generated.justification ||
                    "Requires administrative or dangerous command execution",
                },
              );

              // Poll for human decision in the background
              let decisionMade = false;
              let decisionType: string = "timeout";
              const timeoutAt = Date.now() + 300000; // 5-minute timeout

              console.log(
                `[Coordinator] Registered HITL request ${approvalId}. Waiting...`,
              );

              while (Date.now() < timeoutAt && !decisionMade) {
                await new Promise((resolve) => setTimeout(resolve, 5000));

                const approval = await convexClient.query(
                  api.hitl.getApproval,
                  {
                    id: approvalId,
                  },
                );

                if (approval && approval.decision !== "pending") {
                  decisionMade = true;
                  decisionType = approval.decision;
                }
              }

              if (decisionType === "denied" || decisionType === "timeout") {
                this.emit(
                  "task_fail",
                  `HITL request ${decisionType} for: "${task.title}"`,
                  task.task_id,
                  task.title,
                );
                this.ptg.skipTask(task.task_id);
                await this.syncState("active");
                continue;
              }

              this.emit(
                "hitl_resume",
                "Human approved task execution. Resuming...",
                task.task_id,
                task.title,
              );
            } catch (err: any) {
              console.error("[Coordinator] HITL processing failed:", err);
            }
          } else {
            console.log(
              `[Coordinator] Running locally without Convex. Auto-approving red task: ${task.title}`,
            );
          }
        }

        // G. Execute command in persistent sandbox VM
        this.emit("status", `Executing command in sandbox: ${finalCommand}`);
        await this.logAudit("sandbox_command", {
          taskId: task.task_id,
          command: finalCommand,
        });
        addWorklogEntry(
          this.sessionId,
          "command",
          `Executing: ${finalCommand.slice(0, 60)}...`,
          "running",
        );

        const startShellTime = Date.now();
        const sandbox = await getOrCreateSandbox(this.sessionId);
        let execResult;

        if (finalCommand.startsWith("browser_attack")) {
          try {
            const match = finalCommand.match(/^browser_attack\s+--type\s+(\S+)\s+--url\s+(\S+)/);
            if (match) {
              const url = match[2];
              const { BrowserAttackAgent } = await import("./modules/browser-attack");
              const agent = new BrowserAttackAgent(sandbox);
              const result = await agent.runScanner({ targetUrl: url });
              execResult = {
                exitCode: result.success ? 0 : 1,
                stdout: JSON.stringify({ success: result.success, findings: result.findings }),
                stderr: result.error || ""
              };
            } else {
              execResult = {
                exitCode: 1,
                stdout: "",
                stderr: "Invalid browser_attack command format"
              };
            }
          } catch (err: any) {
            execResult = {
              exitCode: -1,
              stdout: "",
              stderr: `Browser scan execution error: ${err.message}`,
            };
          }
        } else {
          try {
            execResult = await sandbox.commands.run(finalCommand, {
              timeoutMs: 60000,
            });
          } catch (err: any) {
            execResult = {
              exitCode: -1,
              stdout: "",
              stderr: `Execution error: ${err.message}`,
            };
          }
        }

        const durationMs = Date.now() - startShellTime;

        // H. Process execution output
        if (execResult.exitCode !== 0) {
          const errorMsg =
            execResult.stderr || "Command exited with non-zero status";
          const failedAttempt = analyzeFailure(
            task,
            errorMsg,
            execResult.stdout,
            execResult.stderr,
            execResult.exitCode,
          );
          this.failedAttemptsHistory.push(failedAttempt);

          this.ptg.failTask(task.task_id, errorMsg);
          await storeMemory(this.sessionId, task, [], this.ptg);

          addShellEntry(
            this.sessionId,
            finalCommand,
            execResult.stdout || "",
            execResult.stderr || errorMsg,
            execResult.exitCode,
            durationMs,
          );
          addWorklogEntry(
            this.sessionId,
            "command",
            `Failed command: ${finalCommand.slice(0, 60)}...`,
            "error",
            errorMsg,
          );

          this.emit(
            "task_fail",
            `Task failed: "${task.title}" (Error: ${errorMsg})`,
            task.task_id,
            task.title,
          );
        } else {
          // Track shell history
          addShellEntry(
            this.sessionId,
            finalCommand,
            execResult.stdout || "",
            execResult.stderr || "",
            execResult.exitCode,
            durationMs,
          );
          addWorklogEntry(
            this.sessionId,
            "command",
            `Completed: ${task.title}`,
            "success",
          );

          // Sync files inside E2B sandbox to local IDE visualizer panel
          try {
            const filesList = await sandbox.commands.run(
              "find /home/user/pentest -type f -maxdepth 3 2>/dev/null",
            );
            if (filesList.stdout) {
              const filePaths = filesList.stdout.split("\n").filter(Boolean);
              for (const filePath of filePaths.slice(0, 5)) {
                const contentRes = await sandbox.commands.run(
                  `cat "${filePath}" 2>/dev/null`,
                );
                if (contentRes.stdout) {
                  trackIDEFile(this.sessionId, filePath, contentRes.stdout);
                  trackFileChange(
                    this.sessionId,
                    filePath,
                    "write",
                    contentRes.stdout,
                    contentRes.stdout.length,
                  );
                }
              }
            }
          } catch {}

          // I. Parsing structured findings
          const parseResult = await parseOutput(
            finalCommand,
            execResult.stdout,
            execResult.stderr,
          );

          // J. Deterministic Validation
          const validation = await validateFindings(
            sandbox,
            parseResult.findings,
          );
          const validatedFindings = validation.validated.map((v) => v.finding);

          // K. Vulnerability Chaining
          const chains = detectChains(validatedFindings);
          if (chains.length > 0) {
            this.emit(
              "chain_detected",
              `🔗 Chained ${chains.length} findings into highly critical attack paths!`,
            );
            for (const chain of chains) {
              await this.logAudit("llm_call", {
                type: "chain_detection",
                name: chain.name,
                impact: chain.combined_impact,
                cvss: chain.cvss_estimated,
              });
            }
          }

          // L. Complete task and spawn child tasks
          this.ptg.completeTask(task.task_id, validatedFindings);

          const agentId = spawnAgentSession(
            this.sessionId,
            task.phase,
            `Spawning tasks from ${task.title}`,
          );
          let spawnedCount = 0;

          for (const finding of validatedFindings) {
            const children = spawnTasksFromFinding(
              finding,
              task.task_id,
              this.targetScope[0],
            );
            if (children.length > 0) {
              this.ptg.spawnChildTasks(task.task_id, children);
              spawnedCount += children.length;
              addWorklogEntry(
                this.sessionId,
                "agent_spawn",
                `Spawned ${children.length} downstream tasks for: ${finding.description}`,
                "success",
              );
            }
          }

          updateAgentSession(this.sessionId, agentId, {
            status: "completed",
            commandCount: spawnedCount,
          });

          // M. Commit to 4-tier memory
          await storeMemory(this.sessionId, task, validatedFindings, this.ptg);

          this.emit(
            "task_complete",
            `Successfully completed task with ${validatedFindings.length} verified findings.`,
            task.task_id,
            task.title,
            validatedFindings.length,
          );
        }

        await this.syncState("active");

        // Brief delay between tasks for stability
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      // 3. Mark session complete
      this.emit("status", "Autonomous assessment completed successfully.");
      await this.syncState("completed");
    } catch (error: any) {
      console.error("[Coordinator] Fatal Loop Error:", error);
      this.emit("status", `Fatal session error: ${error.message}`);
      await this.syncState("failed");
    } finally {
      this.isRunning = false;
    }

    return this.ptg;
  }

  /**
   * Sync current PTG state to Convex Database.
   */
  private async syncState(status: "active" | "completed" | "failed") {
    if (convexClient) {
      try {
        const convexSessionId = this.sessionId as any;
        await convexClient.mutation(api.sessions.updatePTG, {
          id: convexSessionId,
          ptgState: this.ptg.serialize(),
          status,
        });
      } catch (err: any) {
        console.error(
          "[Coordinator] Failed to sync PTG state to Convex:",
          err.message,
        );
      }
    }
  }

  /**
   * Write event to Convex audit log.
   */
  private async logAudit(eventType: any, payload: any) {
    if (convexClient) {
      try {
        await convexClient.mutation(api.audit.logEvent, {
          sessionId: this.sessionId as any,
          eventType,
          payload,
        });
      } catch (err: any) {
        console.error("[Coordinator] Failed to write audit log:", err.message);
      }
    }
  }

  /**
   * Helper to emit structured progress events.
   */
  private emit(
    type: CoordinatorProgressUpdate["type"],
    message: string,
    taskId?: string,
    taskTitle?: string,
    findingsCount?: number,
  ) {
    const stats = this.ptg.getStats();

    console.log(`[Coordinator: ${type.toUpperCase()}] ${message}`);

    if (this.onProgress) {
      this.onProgress({
        type,
        message,
        taskId,
        taskTitle,
        findingsCount,
        ptgStats: stats,
        currentPtg: this.ptg.serialize(),
      });
    }
  }
}
