/**
 * ULTRON v2.0 — Flow Engine Types & 4-Level Hierarchy
 * Based on PentAGI v1.2 (VXControl, Apr 2026)
 *
 * FLOW → TASK → SUBTASK → ACTION
 */

import type { AgentRole } from "../models";

// ─── Finding (shared across all levels) ──────────────────────────────────────
export interface Finding {
  type: "open_port" | "service" | "vulnerability" | "credential" | "shell_access" | "misconfiguration";
  severity: "info" | "low" | "medium" | "high" | "critical";
  description: string;
  raw_output: string;
  cve_ids: string[];
  cvss_score: number;
  epss_score: number;
  remediation: string;
  evidence: string;
  mitre_technique: string | null;
}

// ─── Flow Modes ──────────────────────────────────────────────────────────────
export type FlowMode =
  | "standard"
  | "ctf"
  | "bug_bounty"
  | "continuous"
  | "ai_redteam"
  | "cicd";

export type FlowStatus = "active" | "paused" | "completed" | "failed";

export type TaskPhase =
  | "recon"
  | "enum"
  | "vuln"
  | "exploit"
  | "post"
  | "report"
  | "ai_redteam";

export type TaskLevel = "task" | "subtask" | "action";

export type TaskStatus =
  | "pending"
  | "running"
  | "success"
  | "failed"
  | "blocked"
  | "paused"
  | "skipped";

export type RiskLevel = "green" | "yellow" | "red";

// ─── Flow (Top-Level Goal) ───────────────────────────────────────────────────
export interface Flow {
  id: string;
  userId: string;
  title: string;
  mode: FlowMode;
  templateId: string | null;
  targetScope: string[];
  status: FlowStatus;
  providerId: string;
  kgSessionId: string | null;
  tasks: FlowTask[];
  createdAt: number;
  updatedAt: number;
}

// ─── Flow Task (Phase-level, Subtask, or Action) ─────────────────────────────
export interface FlowTask {
  id: string;
  flowId: string;
  parentId: string | null;
  level: TaskLevel;
  phase: TaskPhase;
  title: string;
  status: TaskStatus;
  assignedAgent: AgentRole;
  riskLevel: RiskLevel;
  commands: string[];
  findings: Finding[];
  retryCount: number;
  maxRetries: number;
  hitlApprovalId: string | null;
  children: FlowTask[];
  createdAt: number;
  completedAt: number | null;
}

// ─── Flow Template ───────────────────────────────────────────────────────────
export interface FlowTemplate {
  id: string;
  userId: string;
  title: string;
  description: string;
  mode: FlowMode;
  taskTree: FlowTask[];
  isPublic: boolean;
  createdAt: number;
}

// ─── Observability Event ─────────────────────────────────────────────────────
export type ObservabilityEventType =
  | "llm_reasoning"
  | "tool_call"
  | "sandbox_cmd"
  | "hitl"
  | "oob_callback"
  | "finding";

export interface ObservabilityEvent {
  id: string;
  sessionId: string;
  flowId: string;
  taskId: string;
  actionId: string;
  eventType: ObservabilityEventType;
  timestamp: number;

  // LLM Events
  llmReasoning?: string;
  llmDecision?: string;
  llmModel?: string;

  // Tool Events
  toolName?: string;
  toolParams?: Record<string, unknown>;
  toolRawOutput?: string;
  toolFilteredOutput?: string;

  // Sandbox Events
  command?: string;
  exitCode?: number;
  durationMs?: number;
  stdout?: string;
  stderr?: string;

  // Network Events (OOB)
  oobCallback?: {
    sourceIp: string;
    dnsQuery?: string;
    httpPath?: string;
    timestamp: number;
  };

  // HitL Events
  hitlDecision?: "approved" | "denied" | "timeout";
  hitlBy?: string;

  // Metadata
  phase: string;
}

// ─── Flow Engine ─────────────────────────────────────────────────────────────
export class FlowEngine {
  private flow: Flow;

  constructor(flow: Flow) {
    this.flow = flow;
  }

  getFlow(): Flow {
    return this.flow;
  }

  getExecutableTasks(): FlowTask[] {
    return this.flattenTasks()
      .filter(
        (t) =>
          t.status === "pending" &&
          t.level === "action" &&
          this.areDependenciesMet(t),
      )
      .sort((a, b) => {
        const phaseOrder: Record<TaskPhase, number> = {
          recon: 1,
          enum: 2,
          vuln: 3,
          exploit: 4,
          post: 5,
          report: 6,
          ai_redteam: 7,
        };
        return (phaseOrder[a.phase] ?? 99) - (phaseOrder[b.phase] ?? 99);
      });
  }

  private flattenTasks(): FlowTask[] {
    const result: FlowTask[] = [];
    const walk = (tasks: FlowTask[]) => {
      for (const t of tasks) {
        result.push(t);
        if (t.children.length > 0) walk(t.children);
      }
    };
    walk(this.flow.tasks);
    return result;
  }

  private areDependenciesMet(task: FlowTask): boolean {
    if (!task.parentId) return true;
    const parent = this.flattenTasks().find((t) => t.id === task.parentId);
    if (!parent) return true;
    // Parent must be at least "running" for child actions to execute
    return parent.status === "running" || parent.status === "success";
  }

  updateTaskStatus(taskId: string, status: TaskStatus): void {
    const task = this.flattenTasks().find((t) => t.id === taskId);
    if (task) {
      task.status = status;
      if (status === "success" || status === "failed") {
        task.completedAt = Date.now();
      }
      this.flow.updatedAt = Date.now();
    }
  }

  addFinding(taskId: string, finding: Finding): void {
    const task = this.flattenTasks().find((t) => t.id === taskId);
    if (task) {
      task.findings.push(finding);
    }
  }

  isComplete(): boolean {
    return this.flattenTasks()
      .filter((t) => t.level === "task")
      .every((t) => t.status === "success" || t.status === "failed" || t.status === "skipped");
  }
}
