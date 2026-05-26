import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getByFlow = query({
  args: { flowId: v.id("flows") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("attack_reports")
      .withIndex("by_flowId", (q) => q.eq("flowId", args.flowId))
      .collect();
  },
});

export const create = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("attack_reports", {
      flowId: args.flowId,
      format: args.format,
      s3Key: args.s3Key,
      findingsCount: args.findingsCount,
      criticalCount: args.criticalCount,
      highCount: args.highCount,
      cvssMax: args.cvssMax,
      createdAt: Date.now(),
    });
    return id;
  },
});
