import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ═══════════════════════════════════════════════════════════
  // CHAT & MESSAGING (from Ultron-AI)
  // ═══════════════════════════════════════════════════════════

  chats: defineTable({
    id: v.string(),
    title: v.string(),
    user_id: v.string(),
    finish_reason: v.optional(v.string()),
    active_stream_id: v.optional(v.string()),
    active_trigger_run_id: v.optional(v.string()),
    canceled_at: v.optional(v.number()),
    default_model_slug: v.optional(
      v.union(v.literal("ask"), v.literal("agent"), v.literal("agent-long")),
    ),
    todos: v.optional(
      v.array(
        v.object({
          id: v.string(),
          content: v.string(),
          status: v.union(
            v.literal("pending"),
            v.literal("in_progress"),
            v.literal("completed"),
            v.literal("cancelled"),
          ),
          sourceMessageId: v.optional(v.string()),
        }),
      ),
    ),
    branched_from_chat_id: v.optional(v.string()),
    latest_summary_id: v.optional(v.id("chat_summaries")),
    update_time: v.number(),
    share_id: v.optional(v.string()),
    share_date: v.optional(v.number()),
    pinned_at: v.optional(v.number()),
    sandbox_type: v.optional(v.string()),
    selected_model: v.optional(v.string()),
    codex_thread_id: v.optional(v.string()),
  })
    .index("by_chat_id", ["id"])
    .index("by_user_and_updated", ["user_id", "update_time"])
    .index("by_user_and_pinned", ["user_id", "pinned_at"])
    .index("by_share_id", ["share_id"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["user_id"],
    }),

  chat_summaries: defineTable({
    chat_id: v.string(),
    summary_text: v.string(),
    summary_up_to_message_id: v.string(),
    summary_up_to_message_creation_time: v.optional(v.number()),
    previous_summaries: v.optional(
      v.array(
        v.object({
          summary_text: v.string(),
          summary_up_to_message_id: v.string(),
          summary_up_to_message_creation_time: v.optional(v.number()),
        }),
      ),
    ),
  }).index("by_chat_id", ["chat_id"]),

  messages: defineTable({
    id: v.optional(v.string()),
    chat_id: v.optional(v.string()),
    user_id: v.optional(v.string()),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system"),
      v.literal("tool"),
    ),
    parts: v.optional(v.array(v.any())),
    content: v.optional(v.string()),
    file_ids: v.optional(v.array(v.id("files"))),
    feedback_id: v.optional(v.id("feedback")),
    source_message_id: v.optional(v.string()),
    update_time: v.optional(v.number()),
    model: v.optional(v.string()),
    mode: v.optional(v.union(v.literal("agent"), v.literal("ask"))),
    generation_started_at: v.optional(v.number()),
    generation_time_ms: v.optional(v.number()),
    finish_reason: v.optional(v.string()),
    usage: v.optional(v.any()),
    is_hidden: v.optional(v.boolean()),
    conversationId: v.optional(v.id("conversations")),
    createdAt: v.optional(v.number()),
    toolCalls: v.optional(v.any()),
    toolResults: v.optional(v.any()),
  })
    .index("by_message_id", ["id"])
    .index("by_chat_id", ["chat_id"])
    .index("by_feedback_id", ["feedback_id"])
    .index("by_user_id", ["user_id"])
    .index("by_conversationId", ["conversationId"])
    .searchIndex("search_content", {
      searchField: "content",
      filterFields: ["user_id"],
    }),

  // ═══════════════════════════════════════════════════════════
  // FILES & STORAGE (from Ultron-AI)
  // ═══════════════════════════════════════════════════════════

  files: defineTable({
    storage_id: v.optional(v.id("_storage")),
    s3_key: v.optional(v.string()),
    user_id: v.string(),
    name: v.string(),
    media_type: v.string(),
    size: v.number(),
    file_token_size: v.number(),
    content: v.optional(v.string()),
    is_attached: v.boolean(),
  })
    .index("by_user_id", ["user_id"])
    .index("by_is_attached", ["is_attached"])
    .index("by_s3_key", ["s3_key"])
    .index("by_storage_id", ["storage_id"]),

  feedback: defineTable({
    feedback_type: v.union(v.literal("positive"), v.literal("negative")),
    feedback_details: v.optional(v.string()),
  }),

  // ═══════════════════════════════════════════════════════════
  // USER & CUSTOMIZATION (from Ultron-AI)
  // ═══════════════════════════════════════════════════════════

  user_customization: defineTable({
    user_id: v.string(),
    nickname: v.optional(v.string()),
    occupation: v.optional(v.string()),
    personality: v.optional(v.string()),
    traits: v.optional(v.string()),
    additional_info: v.optional(v.string()),
    updated_at: v.number(),
    include_memory_entries: v.optional(v.boolean()),
    guardrails_config: v.optional(v.string()),
    caido_enabled: v.optional(v.boolean()),
    caido_port: v.optional(v.number()),
    extra_usage_enabled: v.optional(v.boolean()),
    max_mode_enabled: v.optional(v.boolean()),
  }).index("by_user_id", ["user_id"]),

  // ═══════════════════════════════════════════════════════════
  // BILLING & USAGE (from Ultron-AI)
  // ═══════════════════════════════════════════════════════════

  extra_usage: defineTable({
    user_id: v.string(),
    balance_points: v.number(),
    auto_reload_enabled: v.optional(v.boolean()),
    auto_reload_threshold_points: v.optional(v.number()),
    auto_reload_amount_dollars: v.optional(v.number()),
    monthly_cap_points: v.optional(v.number()),
    monthly_spent_points: v.optional(v.number()),
    monthly_reset_date: v.optional(v.string()),
    first_successful_charge_at: v.optional(v.number()),
    cumulative_spend_dollars: v.optional(v.number()),
    override_monthly_cap_dollars: v.optional(v.number()),
    auto_reload_consecutive_failures: v.optional(v.number()),
    auto_reload_disabled_reason: v.optional(v.string()),
    updated_at: v.number(),
  }).index("by_user_id", ["user_id"]),

  team_extra_usage: defineTable({
    organization_id: v.string(),
    enabled: v.optional(v.boolean()),
    balance_points: v.number(),
    auto_reload_enabled: v.optional(v.boolean()),
    auto_reload_threshold_points: v.optional(v.number()),
    auto_reload_amount_dollars: v.optional(v.number()),
    monthly_cap_points: v.optional(v.number()),
    monthly_spent_points: v.optional(v.number()),
    monthly_reset_date: v.optional(v.string()),
    first_successful_charge_at: v.optional(v.number()),
    cumulative_spend_dollars: v.optional(v.number()),
    override_monthly_cap_dollars: v.optional(v.number()),
    auto_reload_consecutive_failures: v.optional(v.number()),
    auto_reload_disabled_reason: v.optional(v.string()),
    updated_at: v.number(),
  }).index("by_org", ["organization_id"]),

  team_member_usage: defineTable({
    organization_id: v.string(),
    user_id: v.string(),
    monthly_limit_points: v.optional(v.number()),
    monthly_spent_points: v.optional(v.number()),
    monthly_reset_date: v.optional(v.string()),
    disabled: v.optional(v.boolean()),
    updated_at: v.number(),
  })
    .index("by_org", ["organization_id"])
    .index("by_org_user", ["organization_id", "user_id"]),

  user_suspensions: defineTable({
    user_id: v.string(),
    status: v.union(v.literal("active"), v.literal("resolved")),
    category: v.union(
      v.literal("early_fraud_warning"),
      v.literal("dispute_fraudulent"),
      v.literal("dispute_billing_hold"),
    ),
    source: v.literal("stripe"),
    source_id: v.string(),
    source_reason: v.optional(v.string()),
    stripe_customer_id: v.string(),
    stripe_charge_id: v.optional(v.string()),
    workos_organization_id: v.optional(v.string()),
    created_at: v.number(),
    updated_at: v.number(),
    source_created_at: v.optional(v.number()),
    resolved_at: v.optional(v.number()),
    resolved_reason: v.optional(v.string()),
  })
    .index("by_user_and_status", ["user_id", "status"])
    .index("by_user_status_source_created", ["user_id", "status", "source_created_at"])
    .index("by_user_and_source", ["user_id", "source_id"])
    .index("by_customer_and_status", ["stripe_customer_id", "status"]),

  // ═══════════════════════════════════════════════════════════
  // MEMORIES & NOTES (from Ultron-AI)
  // ═══════════════════════════════════════════════════════════

  memories: defineTable({
    user_id: v.string(),
    memory_id: v.string(),
    content: v.string(),
    update_time: v.number(),
    tokens: v.number(),
  })
    .index("by_memory_id", ["memory_id"])
    .index("by_user_and_update_time", ["user_id", "update_time"]),

  notes: defineTable({
    user_id: v.string(),
    note_id: v.string(),
    title: v.string(),
    content: v.string(),
    category: v.union(
      v.literal("general"),
      v.literal("findings"),
      v.literal("methodology"),
      v.literal("questions"),
      v.literal("plan"),
    ),
    tags: v.array(v.string()),
    tokens: v.number(),
    updated_at: v.number(),
  })
    .index("by_note_id", ["note_id"])
    .index("by_user_and_category", ["user_id", "category"])
    .index("by_user_and_updated", ["user_id", "updated_at"])
    .searchIndex("search_notes", {
      searchField: "content",
      filterFields: ["user_id", "category"],
    }),

  // ═══════════════════════════════════════════════════════════
  // STREAMING & SANDBOX (from Ultron-AI)
  // ═══════════════════════════════════════════════════════════

  temp_streams: defineTable({
    chat_id: v.string(),
    user_id: v.string(),
  }).index("by_chat_id", ["chat_id"]),

  local_sandbox_tokens: defineTable({
    user_id: v.string(),
    token: v.string(),
    token_created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_user_id", ["user_id"])
    .index("by_token", ["token"]),

  local_sandbox_connections: defineTable({
    user_id: v.string(),
    connection_id: v.string(),
    connection_name: v.string(),
    container_id: v.optional(v.string()),
    client_version: v.string(),
    mode: v.union(v.literal("docker"), v.literal("dangerous")),
    os_info: v.optional(
      v.object({
        platform: v.string(),
        arch: v.string(),
        release: v.string(),
        hostname: v.string(),
      }),
    ),
    capabilities: v.optional(
      v.object({
        commands: v.boolean(),
        pty: v.boolean(),
      }),
    ),
    last_heartbeat: v.number(),
    status: v.union(v.literal("connected"), v.literal("disconnected")),
    created_at: v.number(),
    disconnected_at: v.optional(v.number()),
    disconnect_reason: v.optional(
      v.union(
        v.literal("client_disconnect"),
        v.literal("desktop_disconnect"),
        v.literal("desktop_kicked_by_new_session"),
        v.literal("token_regenerated"),
        v.literal("presence_sweep"),
      ),
    ),
  })
    .index("by_user_id", ["user_id"])
    .index("by_connection_id", ["connection_id"])
    .index("by_user_and_status", ["user_id", "status"])
    .index("by_status_and_created_at", ["status", "created_at"]),

  usage_logs: defineTable({
    user_id: v.string(),
    model: v.string(),
    type: v.union(v.literal("included"), v.literal("extra")),
    input_tokens: v.number(),
    output_tokens: v.number(),
    cache_read_tokens: v.optional(v.number()),
    cache_write_tokens: v.optional(v.number()),
    total_tokens: v.number(),
    cost_dollars: v.number(),
    max_mode: v.optional(v.boolean()),
    byok: v.optional(v.boolean()),
  })
    .index("by_user", ["user_id"])
    .index("by_user_and_model", ["user_id", "model"]),

  processed_webhooks: defineTable({
    event_id: v.string(),
    processed_at: v.number(),
    status: v.optional(v.union(v.literal("pending"), v.literal("completed"))),
    claimed_at: v.optional(v.number()),
  }).index("by_event_id", ["event_id"]),

  processed_checkout_sessions: defineTable({
    session_key: v.string(),
    processed_at: v.number(),
  }).index("by_session_key", ["session_key"]),

  // ═══════════════════════════════════════════════════════════
  // ULTRON-AI: PENTEST ENGINE (unique to Ultron)
  // ═══════════════════════════════════════════════════════════

  // Legacy conversations table (kept for backward compat)
  conversations: defineTable({
    title: v.string(),
    model: v.string(),
    mode: v.union(v.literal("chat"), v.literal("agent")),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  pentest_sessions: defineTable({
    conversationId: v.id("conversations"),
    userId: v.string(),
    mode: v.union(v.literal("standard"), v.literal("ctf"), v.literal("bug_bounty"), v.literal("continuous")),
    target_scope: v.array(v.string()),
    ptg_state: v.any(),
    kg_session_id: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("paused"), v.literal("completed"), v.literal("failed")),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_conversationId", ["conversationId"]),

  hitl_approvals: defineTable({
    sessionId: v.id("pentest_sessions"),
    taskId: v.string(),
    riskLevel: v.union(v.literal("yellow"), v.literal("red")),
    command: v.string(),
    justification: v.string(),
    decision: v.union(v.literal("pending"), v.literal("approved"), v.literal("denied"), v.literal("timeout")),
    decidedAt: v.optional(v.number()),
    timeoutAt: v.number(),
    createdAt: v.number(),
  }).index("by_sessionId", ["sessionId"]),

  audit_log: defineTable({
    sessionId: v.id("pentest_sessions"),
    eventType: v.union(v.literal("llm_call"), v.literal("tool_invocation"), v.literal("sandbox_command"), v.literal("hitl_decision")),
    payload: v.any(),
    timestamp: v.number(),
  }).index("by_sessionId", ["sessionId"]),

  rag_retrievals: defineTable({
    sessionId: v.id("pentest_sessions"),
    query: v.string(),
    collection: v.union(v.literal("cve_exploits"), v.literal("pentest_writeups"), v.literal("past_sessions")),
    results: v.any(),
    createdAt: v.number(),
  }),

  attack_reports: defineTable({
    sessionId: v.id("pentest_sessions"),
    format: v.union(v.literal("pdf"), v.literal("word"), v.literal("excel"), v.literal("hackerone"), v.literal("bugcrowd"), v.literal("ctf_writeup")),
    s3Key: v.string(),
    findingsCount: v.number(),
    criticalCount: v.number(),
    highCount: v.number(),
    cvssMax: v.number(),
    createdAt: v.number(),
  }),

  // ═══════════════════════════════════════════════════════════
  // ULTRON-AI: FLOW ENGINE v2.0 (unique to Ultron)
  // ═══════════════════════════════════════════════════════════

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

  flow_templates: defineTable({
    userId: v.string(),
    title: v.string(),
    description: v.string(),
    mode: v.string(),
    taskTree: v.string(),
    isPublic: v.boolean(),
    createdAt: v.number(),
  }).index("by_userId", ["userId"]),

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
    payload: v.string(),
    timestamp: v.number(),
  }).index("by_sessionId", ["sessionId"]),

  browser_sessions: defineTable({
    flowId: v.id("flows"),
    targetUrl: v.string(),
    screenshots: v.array(v.string()),
    httpLog: v.string(),
    domSnapshots: v.array(v.string()),
    createdAt: v.number(),
  }).index("by_flowId", ["flowId"]),

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
});
