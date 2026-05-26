import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getByUser = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("flows")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { id: v.id("flows") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
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
    targetScope: v.array(v.string()),
    providerId: v.string(),
    templateId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("flows", {
      userId: args.userId,
      title: args.title,
      mode: args.mode,
      templateId: args.templateId,
      targetScope: args.targetScope,
      status: "active",
      providerId: args.providerId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return id;
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("flows"),
    status: v.union(
      v.literal("active"),
      v.literal("paused"),
      v.literal("completed"),
      v.literal("failed"),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});
