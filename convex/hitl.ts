import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getPending = query({
  args: { sessionId: v.id("pentest_sessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("hitl_approvals")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .filter((q) => q.eq(q.field("decision"), "pending"))
      .first();
  },
});

export const requestApproval = mutation({
  args: {
    sessionId: v.id("pentest_sessions"),
    taskId: v.string(),
    riskLevel: v.union(v.literal("yellow"), v.literal("red")),
    command: v.string(),
    justification: v.string(),
    timeoutSeconds: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const timeoutMs = (args.timeoutSeconds || 300) * 1000;
    const id = await ctx.db.insert("hitl_approvals", {
      sessionId: args.sessionId,
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

export const getApproval = query({
  args: { id: v.id("hitl_approvals") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const submitDecisionForSession = mutation({
  args: {
    sessionId: v.id("pentest_sessions"),
    decision: v.union(v.literal("approved"), v.literal("denied"), v.literal("timeout")),
  },
  handler: async (ctx, args) => {
    const pending = await ctx.db
      .query("hitl_approvals")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .filter((q) => q.eq(q.field("decision"), "pending"))
      .first();

    if (pending) {
      await ctx.db.patch(pending._id, {
        decision: args.decision,
        decidedAt: Date.now(),
      });
      return pending._id;
    }
    return null;
  },
});

