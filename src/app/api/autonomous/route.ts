import { NextRequest, NextResponse } from "next/server";
import { AutonomousPlanner } from "@/lib/agent/planner";
import { AutonomousRunner } from "@/lib/agent/autonomous-runner";
import { Redis } from "@upstash/redis";

// Initialize Upstash Redis if configured
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

/**
 * POST /api/autonomous
 * Starts a new autonomous pentesting session.
 */
export async function POST(req: NextRequest) {
  try {
    const { target, mode = "standard", maxIterations = 48 } = await req.json();

    if (!target) {
      return NextResponse.json({ error: "Missing target parameter" }, { status: 400 });
    }

    const sessionId = `auto_session_${Date.now()}`;
    const planner = new AutonomousPlanner(sessionId);

    // 1. Generate task plan
    const planOutput = await planner.plan({ target, mode });

    // 2. Initialize state in Redis if available
    if (redis) {
      await redis.set(`ultron:checkpoint:${sessionId}`, JSON.stringify({
        status: "active",
        plan: planOutput.plan,
        target,
        mode,
        timestamp: Date.now()
      }));
    }

    // 3. Launch runner in the background (asynchronous execution)
    const runner = new AutonomousRunner({
      sessionId,
      target,
      mode: mode as any,
      maxIterations
    });

    // Run asynchronously
    runner.run().catch(err => {
      console.error(`[Autonomous API] Background execution failed for session ${sessionId}:`, err);
    });

    return NextResponse.json({
      sessionId,
      target,
      mode,
      plan: planOutput.plan,
      thinkingChain: planOutput.thinkingChain,
      estimatedDuration: planOutput.estimatedDuration,
      summary: planOutput.summary
    });
  } catch (error: any) {
    console.error("[Autonomous API POST Error]:", error);
    return NextResponse.json({ error: error.message || "Unknown error occurred" }, { status: 500 });
  }
}

/**
 * GET /api/autonomous
 * Fetches status of an active session.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId parameter" }, { status: 400 });
    }

    if (!redis) {
      return NextResponse.json({ error: "State persistence is not configured" }, { status: 501 });
    }

    const checkpoint = await redis.get(`ultron:checkpoint:${sessionId}`);

    if (!checkpoint) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json(typeof checkpoint === "string" ? JSON.parse(checkpoint) : checkpoint);
  } catch (error: any) {
    console.error("[Autonomous API GET Error]:", error);
    return NextResponse.json({ error: error.message || "Unknown error occurred" }, { status: 500 });
  }
}

/**
 * DELETE /api/autonomous
 * Stops/cancels an active session.
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId parameter" }, { status: 400 });
    }

    if (!redis) {
      return NextResponse.json({ error: "State persistence is not configured" }, { status: 501 });
    }

    const checkpoint = await redis.get(`ultron:checkpoint:${sessionId}`);

    if (!checkpoint) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const state = typeof checkpoint === "string" ? JSON.parse(checkpoint) : checkpoint;
    state.status = "failed"; // Cancelled status
    await redis.set(`ultron:checkpoint:${sessionId}`, JSON.stringify(state));

    return NextResponse.json({ message: "Session stopped successfully", sessionId });
  } catch (error: any) {
    console.error("[Autonomous API DELETE Error]:", error);
    return NextResponse.json({ error: error.message || "Unknown error occurred" }, { status: 500 });
  }
}
