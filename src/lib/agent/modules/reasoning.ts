/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Reasoning Module v2.0 — Adaptive with Extended Thinking
 * ═══════════════════════════════════════════════════════════════
 * UPGRADES:
 *  - LLM-powered task selection (not just priority sorting)
 *  - Extended Thinking for complex decisions (exploit, post-exploit)
 *  - Failure analysis and strategy adaptation
 *  - Context-aware prioritization based on findings
 * ═══════════════════════════════════════════════════════════════
 */

import { PTGNode, PenetrationTaskGraph, Finding } from "../ptg";
import {
  AttackStrategy,
  adaptStrategy,
  FailedAttempt,
  detectBlockReason,
} from "../strategies";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReasoningContext {
  currentFindings: Finding[];
  failedAttempts: FailedAttempt[];
  attackSurface?: any;
  sessionMode: "standard" | "ctf" | "bug_bounty" | "continuous";
}

interface ReasoningDecision {
  task: PTGNode;
  strategy: AttackStrategy;
  reasoning: string; // Why this task was selected
  extended_thinking?: string; // Chain-of-thought for complex decisions
}

// ─── Extended Thinking Check ──────────────────────────────────────────────────

/**
 * Determine if a task requires Extended Thinking for deeper reasoning.
 */
function shouldUseExtendedThinking(
  task: PTGNode,
  graph: PenetrationTaskGraph,
): boolean {
  return (
    task.phase === "exploit" || // Complex exploit selection
    task.phase === "post" || // Post-exploit planning
    task.risk_level === "red" || // High-risk operations
    task.retry_count > 0 || // Retry after failure — need to adapt
    graph.getParallelBranches().length > 3 // Coordinating many branches
  );
}

// ─── LLM-Powered Reasoning ───────────────────────────────────────────────────

/**
 * Use LLM to reason about which task to execute next and how.
 * Falls back to priority-based selection if LLM is unavailable.
 */
async function llmReason(
  tasks: PTGNode[],
  context: ReasoningContext,
  useExtendedThinking: boolean,
): Promise<{ selectedIndex: number; reasoning: string; thinking?: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    // Fallback: priority-based selection
    return {
      selectedIndex: 0,
      reasoning: `Selected highest-priority task: "${tasks[0].title}" (P${tasks[0].priority})`,
    };
  }

  try {
    const provider = createOpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey,
    });

    const taskList = tasks
      .map(
        (t, i) =>
          `[${i}] Phase: ${t.phase} | Title: "${t.title}" | Priority: P${t.priority} | Risk: ${t.risk_level} | Retries: ${t.retry_count}`,
      )
      .join("\n");

    const findingSummary =
      context.currentFindings.length > 0
        ? context.currentFindings
            .slice(-10)
            .map((f) => `- [${f.severity}] ${f.description}`)
            .join("\n")
        : "No findings yet.";

    const failureSummary =
      context.failedAttempts.length > 0
        ? context.failedAttempts
            .slice(-5)
            .map(
              (f) =>
                `- ${f.strategy.description}: ${f.error} (${f.blockReason})`,
            )
            .join("\n")
        : "No failures.";

    const prompt = `You are the Reasoning Module of an autonomous penetration testing AI.

## Current State
Mode: ${context.sessionMode}
Total findings: ${context.currentFindings.length}
Failed attempts: ${context.failedAttempts.length}

## Available Tasks
${taskList}

## Recent Findings
${findingSummary}

## Recent Failures
${failureSummary}

## Decision Required
Select the optimal next task index [0-${tasks.length - 1}] and explain your reasoning.
Consider:
1. Which task has the highest potential impact given current findings?
2. Are there any findings that suggest a specific attack path?
3. If there were failures, should we try a different approach?
4. What phase should we focus on (recon/enum/vuln/exploit/post)?

Respond in this format:
SELECTED: [index]
REASONING: [1-2 sentences explaining why]`;

    const result = await generateText({
      model: provider(
        useExtendedThinking
          ? "anthropic/claude-sonnet-4-6"
          : "x-ai/grok-4.1-fast",
      ),
      prompt,
      maxTokens: 500,
    } as any);

    const text = result.text;

    // Parse response
    const selectedMatch = text.match(/SELECTED:\s*(\d+)/);
    const reasoningMatch = text.match(/REASONING:\s*([\s\S]+)/);

    const selectedIndex = selectedMatch
      ? Math.min(parseInt(selectedMatch[1]), tasks.length - 1)
      : 0;

    return {
      selectedIndex,
      reasoning:
        reasoningMatch?.[1]?.trim() || `LLM selected task ${selectedIndex}`,
      thinking: useExtendedThinking ? text : undefined,
    };
  } catch (err: any) {
    console.error(`[Reasoning] LLM reasoning failed: ${err.message}`);
    return {
      selectedIndex: 0,
      reasoning: `Fallback: selected highest-priority task "${tasks[0].title}"`,
    };
  }
}

// ─── Main Reasoning Function ──────────────────────────────────────────────────

/**
 * Select the next task to execute from the PTG, using LLM reasoning.
 */
export async function decideNextTask(
  graph: PenetrationTaskGraph,
  context: ReasoningContext = {
    currentFindings: [],
    failedAttempts: [],
    sessionMode: "standard",
  },
): Promise<ReasoningDecision | null> {
  const executableTasks = graph.getExecutableTasks();

  if (executableTasks.length === 0) {
    console.log("[Reasoning] No executable tasks available");
    return null;
  }

  // Single task — no decision needed
  if (executableTasks.length === 1) {
    const task = executableTasks[0];
    console.log(`[Reasoning] Only one task available: "${task.title}"`);
    return {
      task,
      strategy: {
        id: "default",
        encoding: "none",
        httpMethod: "GET",
        delay: 0,
        payloadVariant: 0,
        headers: {},
        bypassTechniques: [],
        description: "Default strategy",
      },
      reasoning: `Only one executable task: "${task.title}"`,
    };
  }

  // Multiple tasks — use LLM reasoning
  const useET = executableTasks.some((t) =>
    shouldUseExtendedThinking(t, graph),
  );
  console.log(
    `[Reasoning] ${executableTasks.length} tasks available, using ${useET ? "Extended Thinking" : "standard"} reasoning`,
  );

  const decision = await llmReason(executableTasks, context, useET);
  const selectedTask = executableTasks[decision.selectedIndex];

  // Determine strategy based on failure history
  let strategy: AttackStrategy = {
    id: "default",
    encoding: "none",
    httpMethod: "GET",
    delay: 0,
    payloadVariant: 0,
    headers: {},
    bypassTechniques: [],
    description: "Default strategy",
  };

  // If this task has failed before, adapt the strategy
  if (selectedTask.retry_count > 0 && context.failedAttempts.length > 0) {
    const relevantFailure = context.failedAttempts.find((f) =>
      f.strategy.id.includes(selectedTask.task_id),
    );
    if (relevantFailure) {
      strategy = adaptStrategy(relevantFailure, selectedTask.retry_count);
      console.log(
        `[Reasoning] Adapted strategy for retry: ${strategy.description}`,
      );
    }
  }

  console.log(
    `[Reasoning] Selected: "${selectedTask.title}" (${selectedTask.phase}) — ${decision.reasoning}`,
  );

  return {
    task: selectedTask,
    strategy,
    reasoning: decision.reasoning,
    extended_thinking: decision.thinking,
  };
}

/**
 * Analyze a failure and determine the best recovery approach.
 */
export function analyzeFailure(
  task: PTGNode,
  error: string,
  stdout: string,
  stderr: string,
  exitCode: number,
): FailedAttempt {
  const blockReason = detectBlockReason(stdout, stderr, exitCode);

  console.log(
    `[Reasoning] Failure analysis for "${task.title}": ${blockReason}`,
  );

  return {
    strategy: {
      id: task.strategy_id || "default",
      encoding: "none",
      httpMethod: "GET",
      delay: 0,
      payloadVariant: 0,
      headers: {},
      bypassTechniques: [],
      description: task.title,
    },
    error,
    blockReason,
    timestamp: Date.now(),
  };
}
