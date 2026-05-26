import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const logEvent = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("observability_events", {
      sessionId: args.sessionId,
      flowId: args.flowId,
      taskId: args.taskId,
      eventType: args.eventType,
      payload: args.payload,
      timestamp: Date.now(),
    });
    return id;
  },
});

export const getBySession = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("observability_events")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();
  },
});
