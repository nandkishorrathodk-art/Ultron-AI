import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // === Conversations (chat sessions) ===
  conversations: defineTable({
    title: v.string(),
    model: v.string(),
    mode: v.union(v.literal("chat"), v.literal("agent")),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  // === Messages ===
  messages: defineTable({
    conversationId: v.id("conversations"),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("tool")),
    content: v.string(),
    toolCalls: v.optional(v.array(v.object({
      id: v.string(),
      name: v.string(),
      arguments: v.string(),
    }))),
    toolResults: v.optional(v.array(v.object({
      toolCallId: v.string(),
      result: v.string(),
    }))),
    createdAt: v.number(),
  }).index("by_conversationId", ["conversationId"]),

  // === Flows (v3.0 — replaces pentest_sessions) ===
  flows: defineTable({
    userId: v.string(),
    title: v.string(),
    mode: v.union(
      v.literal("standard"),
      v.literal("ctf"),
      v.literal("bug_bounty"),
      v.literal("continuous"),
      v.literal("ai_redteam"),
      v.literal("cicd"),
    ),
    templateId: v.optional(v.string()),
    targetScope: v.array(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("paused"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    providerId: v.string(),
    kgSessionId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),

  // === Flow Tasks (4-level hierarchy) ===
  flow_tasks: defineTable({
    flowId: v.id("flows"),
    parentId: v.optional(v.id("flow_tasks")),
    level: v.union(v.literal("task"), v.literal("subtask"), v.literal("action")),
    phase: v.union(
      v.literal("recon"),
      v.literal("enum"),
      v.literal("vuln"),
      v.literal("exploit"),
      v.literal("post"),
      v.literal("report"),
      v.literal("ai_redteam"),
    ),
    title: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("success"),
      v.literal("failed"),
      v.literal("blocked"),
      v.literal("paused"),
      v.literal("skipped"),
    ),
    assignedAgent: v.string(),
    riskLevel: v.union(v.literal("green"), v.literal("yellow"), v.literal("red")),
    commands: v.array(v.string()),
    findings: v.array(v.object({
      type: v.string(),
      severity: v.string(),
      description: v.string(),
      rawOutput: v.string(),
      cveIds: v.array(v.string()),
      cvssScore: v.number(),
      epssScore: v.number(),
      remediation: v.string(),
      evidence: v.string(),
    })),
    retryCount: v.number(),
    maxRetries: v.number(),
    hitlApprovalId: v.optional(v.string()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  }).index("by_flowId", ["flowId"]),

  // === Flow Templates (NEW in v3.0) ===
  flow_templates: defineTable({
    userId: v.string(),
    title: v.string(),
    description: v.string(),
    mode: v.string(),
    taskTree: v.string(), // JSON-serialized task template
    isPublic: v.boolean(),
    createdAt: v.number(),
  }).index("by_userId", ["userId"]),

  // === Human-in-the-Loop Approvals ===
  hitl_approvals: defineTable({
    flowId: v.id("flows"),
    taskId: v.string(),
    riskLevel: v.union(v.literal("yellow"), v.literal("red")),
    command: v.string(),
    justification: v.string(),
    decision: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("denied"),
      v.literal("timeout"),
    ),
    decidedAt: v.optional(v.number()),
    timeoutAt: v.number(),
    createdAt: v.number(),
  }).index("by_flowId", ["flowId"]),

  // === Observability Events (v3.0 — replaces audit_log) ===
  observability_events: defineTable({
    sessionId: v.string(),
    flowId: v.optional(v.id("flows")),
    taskId: v.optional(v.string()),
    eventType: v.union(
      v.literal("llm_reasoning"),
      v.literal("tool_call"),
      v.literal("sandbox_cmd"),
      v.literal("hitl"),
      v.literal("oob_callback"),
      v.literal("finding"),
    ),
    payload: v.string(), // JSON-serialized ObservabilityEvent
    timestamp: v.number(),
  }).index("by_sessionId", ["sessionId"]),

  // === Browser Sessions (NEW in v3.0) ===
  browser_sessions: defineTable({
    flowId: v.id("flows"),
    targetUrl: v.string(),
    screenshots: v.array(v.string()),
    httpLog: v.string(), // JSON-serialized
    domSnapshots: v.array(v.string()),
    createdAt: v.number(),
  }).index("by_flowId", ["flowId"]),

  // === LLM Red Team Results (NEW in v3.0) ===
  llm_redteam_results: defineTable({
    flowId: v.id("flows"),
    targetAppUrl: v.string(),
    owaspCategory: v.string(),
    attackStrategy: v.string(),
    success: v.boolean(),
    evidence: v.string(),
    severity: v.union(
      v.literal("critical"),
      v.literal("high"),
      v.literal("medium"),
      v.literal("low"),
    ),
    remediation: v.string(),
    createdAt: v.number(),
  }).index("by_flowId", ["flowId"]),

  // === Attack Reports ===
  attack_reports: defineTable({
    flowId: v.id("flows"),
    format: v.union(
      v.literal("pdf"),
      v.literal("word"),
      v.literal("excel"),
      v.literal("hackerone"),
      v.literal("bugcrowd"),
      v.literal("ctf_writeup"),
    ),
    s3Key: v.string(),
    findingsCount: v.number(),
    criticalCount: v.number(),
    highCount: v.number(),
    cvssMax: v.number(),
    createdAt: v.number(),
  }).index("by_flowId", ["flowId"]),

  // === RAG Retrievals ===
  rag_retrievals: defineTable({
    flowId: v.id("flows"),
    query: v.string(),
    collection: v.union(
      v.literal("cve_exploits"),
      v.literal("pentest_writeups"),
      v.literal("past_sessions"),
    ),
    resultCount: v.number(),
    topScore: v.number(),
    createdAt: v.number(),
  }).index("by_flowId", ["flowId"]),
});
