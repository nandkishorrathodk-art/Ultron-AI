/**
 * Penetration Task Graph (PTG) v2.0 — Enhanced
 * ═══════════════════════════════════════════════════════════════
 * UPGRADES OVER v1.0:
 *  - spawnChildTasks() for dynamic task creation from findings
 *  - getParallelBranches() for concurrent execution
 *  - markFailed() with retry logic and backoff
 *  - serialize() / deserialize() for Convex persistence
 *  - Statistics: total tasks, completed, coverage, success rate
 *  - failTask / completeTask lifecycle methods
 * ═══════════════════════════════════════════════════════════════
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Finding {
  type:
    | "open_port"
    | "service"
    | "vulnerability"
    | "credential"
    | "shell_access";
  severity: "info" | "low" | "medium" | "high" | "critical";
  description: string;
  raw_output: string;
  cve_ids: string[];
  cvss_score: number;
  epss_score: number;
  remediation: string;
  evidence: string;
  validated?: boolean; // NEW: deterministic validation flag
  chain_id?: string; // NEW: if part of a vuln chain
  endpoint?: string; // NEW: specific endpoint where found
  mitre_technique?: string; // NEW: MITRE ATT&CK technique
}

export interface PTGNode {
  task_id: string;
  parent_ids: string[];
  child_ids: string[];
  phase: "recon" | "enum" | "vuln" | "exploit" | "post" | "report";
  title: string;
  status: "pending" | "running" | "success" | "failed" | "blocked" | "skipped";
  risk_level: "green" | "yellow" | "red";
  priority: 1 | 2 | 3 | 4 | 5;
  assigned_agent: string | null;
  commands: string[];
  findings: Finding[];
  cvss_score: number | null;
  epss_score: number | null;
  mitre_technique: string | null;
  retry_count: number;
  max_retries: number;
  created_at: number;
  started_at: number | null;
  completed_at: number | null;
  hitl_approval: {
    required: boolean;
    approved_by: string | null;
    approved_at: number | null;
    denied_at: number | null;
    timeout_at: number;
  };
  // NEW fields
  error_log?: string[]; // Track errors for adaptive reasoning
  strategy_id?: string; // Which attack strategy was used
  execution_time_ms?: number; // How long the task took
}

// ─── Statistics ───────────────────────────────────────────────────────────────

export interface PTGStats {
  totalTasks: number;
  pending: number;
  running: number;
  success: number;
  failed: number;
  blocked: number;
  skipped: number;
  totalFindings: number;
  criticalFindings: number;
  highFindings: number;
  validatedFindings: number;
  coveragePercent: number; // (completed / total) * 100
  successRate: number; // (success / (success + failed)) * 100
}

// ─── PTG Class ────────────────────────────────────────────────────────────────

export class PenetrationTaskGraph {
  nodes: Map<string, PTGNode> = new Map();
  private allFindings: Finding[] = [];

  // ─── Basic CRUD ─────────────────────────────────────────────

  addNode(node: PTGNode): void {
    this.nodes.set(node.task_id, node);
  }

  addNodes(nodes: PTGNode[]): void {
    for (const node of nodes) {
      this.nodes.set(node.task_id, node);
    }
  }

  getNode(id: string): PTGNode | undefined {
    return this.nodes.get(id);
  }

  getAllNodes(): PTGNode[] {
    return Array.from(this.nodes.values());
  }

  // ─── Task Selection ─────────────────────────────────────────

  /**
   * Get all tasks that are ready to execute:
   * - status is "pending"
   * - all parent tasks have completed successfully
   * Sorted by priority (1 = highest)
   */
  getExecutableTasks(): PTGNode[] {
    return Array.from(this.nodes.values())
      .filter(
        (n) =>
          n.status === "pending" &&
          n.parent_ids.every((parentId) => {
            const parent = this.nodes.get(parentId);
            return parent?.status === "success" || parent?.status === "skipped";
          }),
      )
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get independent task branches that can run concurrently.
   * Returns groups of tasks with no dependency conflicts.
   */
  getParallelBranches(): PTGNode[][] {
    const executable = this.getExecutableTasks();
    if (executable.length <= 1)
      return executable.length === 1 ? [executable] : [];

    // Group by phase — tasks in the same phase are usually parallelizable
    const phaseGroups = new Map<string, PTGNode[]>();
    for (const task of executable) {
      const group = phaseGroups.get(task.phase) || [];
      group.push(task);
      phaseGroups.set(task.phase, group);
    }

    return Array.from(phaseGroups.values());
  }

  // ─── Task Lifecycle ─────────────────────────────────────────

  /**
   * Start executing a task.
   */
  startTask(taskId: string): PTGNode | null {
    const node = this.nodes.get(taskId);
    if (!node || node.status !== "pending") return null;

    node.status = "running";
    node.started_at = Date.now();
    return node;
  }

  /**
   * Mark a task as successfully completed with findings.
   */
  completeTask(taskId: string, findings: Finding[]): PTGNode | null {
    const node = this.nodes.get(taskId);
    if (!node) return null;

    node.status = "success";
    node.completed_at = Date.now();
    node.execution_time_ms = node.started_at ? Date.now() - node.started_at : 0;
    node.findings = findings;
    this.allFindings.push(...findings);

    // Unblock children
    this.updateBlockedChildren(taskId);

    return node;
  }

  /**
   * Mark a task as failed. If retries remain, reset to pending.
   * Returns true if the task was retried, false if permanently failed.
   */
  failTask(taskId: string, error: string): boolean {
    const node = this.nodes.get(taskId);
    if (!node) return false;

    node.retry_count++;
    if (!node.error_log) node.error_log = [];
    node.error_log.push(`[Attempt ${node.retry_count}] ${error}`);

    if (node.retry_count < node.max_retries) {
      // Retry — reset to pending
      node.status = "pending";
      node.started_at = null;
      console.log(
        `[PTG] Task ${node.title} failed (attempt ${node.retry_count}/${node.max_retries}), retrying...`,
      );
      return true;
    }

    // Permanently failed
    node.status = "failed";
    node.completed_at = Date.now();
    console.log(
      `[PTG] Task ${node.title} permanently failed after ${node.max_retries} attempts`,
    );

    // Skip dependent children
    this.skipDependents(taskId);
    return false;
  }

  /**
   * Skip a task (e.g., parent failed, or HitL denied).
   */
  skipTask(taskId: string): void {
    const node = this.nodes.get(taskId);
    if (!node) return;

    node.status = "skipped";
    node.completed_at = Date.now();
    this.skipDependents(taskId);
  }

  // ─── Dynamic Task Spawning ──────────────────────────────────

  /**
   * Spawn child tasks from a parent task (e.g., finding → new tasks).
   * This is the XBOW-style auto-spawn behavior.
   */
  spawnChildTasks(parentId: string, children: PTGNode[]): void {
    const parent = this.nodes.get(parentId);
    if (!parent) return;

    for (const child of children) {
      // Ensure parent link
      if (!child.parent_ids.includes(parentId)) {
        child.parent_ids.push(parentId);
      }

      // Add to graph
      this.nodes.set(child.task_id, child);
      parent.child_ids.push(child.task_id);
    }

    console.log(
      `[PTG] Spawned ${children.length} child tasks from "${parent.title}"`,
    );
  }

  // ─── Internal Helpers ───────────────────────────────────────

  private updateBlockedChildren(completedTaskId: string): void {
    const parent = this.nodes.get(completedTaskId);
    if (!parent) return;

    for (const childId of parent.child_ids) {
      const child = this.nodes.get(childId);
      if (child?.status === "blocked") {
        // Check if all parents are now complete
        const allParentsDone = child.parent_ids.every((pid) => {
          const p = this.nodes.get(pid);
          return p?.status === "success" || p?.status === "skipped";
        });
        if (allParentsDone) {
          child.status = "pending";
        }
      }
    }
  }

  private skipDependents(taskId: string): void {
    const node = this.nodes.get(taskId);
    if (!node) return;

    for (const childId of node.child_ids) {
      const child = this.nodes.get(childId);
      if (child && (child.status === "pending" || child.status === "blocked")) {
        // Only skip if ALL parents failed/skipped (not just one)
        const allParentsFailed = child.parent_ids.every((pid) => {
          const p = this.nodes.get(pid);
          return p?.status === "failed" || p?.status === "skipped";
        });

        if (allParentsFailed) {
          this.skipTask(childId);
        }
      }
    }
  }

  // ─── Statistics ─────────────────────────────────────────────

  getStats(): PTGStats {
    const nodes = Array.from(this.nodes.values());
    const total = nodes.length;
    const byStatus = {
      pending: 0,
      running: 0,
      success: 0,
      failed: 0,
      blocked: 0,
      skipped: 0,
    };

    for (const node of nodes) {
      byStatus[node.status]++;
    }

    const completed = byStatus.success + byStatus.failed + byStatus.skipped;
    const validatedFindings = this.allFindings.filter(
      (f) => f.validated,
    ).length;

    return {
      totalTasks: total,
      ...byStatus,
      totalFindings: this.allFindings.length,
      criticalFindings: this.allFindings.filter(
        (f) => f.severity === "critical",
      ).length,
      highFindings: this.allFindings.filter((f) => f.severity === "high")
        .length,
      validatedFindings,
      coveragePercent: total > 0 ? Math.round((completed / total) * 100) : 0,
      successRate:
        byStatus.success + byStatus.failed > 0
          ? Math.round(
              (byStatus.success / (byStatus.success + byStatus.failed)) * 100,
            )
          : 0,
    };
  }

  getAllFindings(): Finding[] {
    return [...this.allFindings];
  }

  // ─── Serialization (Convex Persistence) ─────────────────────

  /**
   * Serialize the entire PTG to a JSON-safe object for Convex storage.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  serialize(): any {
    return {
      nodes: Array.from(this.nodes.entries()).map(([id, node]) => ({
        id,
        ...node,
      })),
      allFindings: this.allFindings,
      serializedAt: Date.now(),
    };
  }

  /**
   * Restore a PTG from a serialized object (e.g., from Convex).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static deserialize(data: any): PenetrationTaskGraph {
    const ptg = new PenetrationTaskGraph();

    if (data?.nodes && Array.isArray(data.nodes)) {
      for (const entry of data.nodes) {
        const { id, ...node } = entry;
        ptg.nodes.set(id || node.task_id, node as PTGNode);
      }
    }

    if (data?.allFindings && Array.isArray(data.allFindings)) {
      ptg.allFindings = data.allFindings;
    }

    return ptg;
  }

  // ─── Debug ──────────────────────────────────────────────────

  /**
   * Print a human-readable summary of the PTG.
   */
  printSummary(): string {
    const stats = this.getStats();
    const lines: string[] = [
      `\n═══ Penetration Task Graph Summary ═══`,
      `Tasks: ${stats.totalTasks} total | ${stats.success} ✅ | ${stats.failed} ❌ | ${stats.pending} ⏳ | ${stats.running} 🔄`,
      `Coverage: ${stats.coveragePercent}% | Success Rate: ${stats.successRate}%`,
      `Findings: ${stats.totalFindings} total | ${stats.criticalFindings} critical | ${stats.highFindings} high | ${stats.validatedFindings} validated`,
      `═══════════════════════════════════════\n`,
    ];

    // Task list
    for (const node of this.nodes.values()) {
      const statusIcon = {
        pending: "⏳",
        running: "🔄",
        success: "✅",
        failed: "❌",
        blocked: "🚫",
        skipped: "⏭️",
      }[node.status];

      const riskIcon = {
        green: "🟢",
        yellow: "🟡",
        red: "🔴",
      }[node.risk_level];

      lines.push(
        `  ${statusIcon} ${riskIcon} [P${node.priority}] ${node.title} (${node.phase}) ${
          node.findings.length > 0 ? `→ ${node.findings.length} findings` : ""
        }`,
      );
    }

    return lines.join("\n");
  }

  /**
   * Check if the pentest is complete (no more executable tasks).
   */
  isComplete(): boolean {
    const executable = this.getExecutableTasks();
    const running = Array.from(this.nodes.values()).filter(
      (n) => n.status === "running",
    );
    return executable.length === 0 && running.length === 0;
  }

  /**
   * Check if there's any task still in progress.
   */
  hasActiveTasks(): boolean {
    return Array.from(this.nodes.values()).some(
      (n) => n.status === "running" || n.status === "pending",
    );
  }
}
