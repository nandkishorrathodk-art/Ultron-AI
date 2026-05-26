import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getPending = query({
  args: { flowId: v.id("flows") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("hitl_approvals")
      .withIndex("by_flowId", (q) => q.eq("flowId", args.flowId))
      .filter((q) => q.eq(q.field("decision"), "pending"))
      .first();
  },
});

export const requestApproval = mutation({
  args: {
    flowId: v.id("flows"),
    taskId: v.string(),
    riskLevel: v.union(v.literal("yellow"), v.literal("red")),
    command: v.string(),
    justification: v.string(),
    timeoutSeconds: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const timeoutMs = (args.timeoutSeconds || 300) * 1000;
    const id = await ctx.db.insert("hitl_approvals", {
      flowId: args.flowId,
      taskId: args.taskId,
      riskLevel: args.riskLevel,
      command: args.command,
      justification: args.justification,
      decision: "pending",
      timeoutAt: Date.now() + timeoutMs,
      createdAt: Date.now(),
    });
    return id;
  },
});

export const submitDecision = mutation({
  args: {
    id: v.id("hitl_approvals"),
    decision: v.union(v.literal("approved"), v.literal("denied"), v.literal("timeout")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      decision: args.decision,
      decidedAt: Date.now(),
    });
  },
});
