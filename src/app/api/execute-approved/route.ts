import { getOrCreateSandbox, addSandboxLog } from "@/lib/sandbox-manager";
import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL || "";
const convexClient = convexUrl ? new ConvexHttpClient(convexUrl) : null;

export async function POST(req: Request) {
  try {
    const { command, sessionId, denied } = await req.json();

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required to reuse the persistent sandbox" }, { status: 400 });
    }

    // 1. Handle Denied Decision
    if (denied) {
      console.log(`[execute-approved] Human denied action in session ${sessionId}`);
      if (convexClient) {
        try {
          await convexClient.mutation(api.hitl.submitDecisionForSession, {
            sessionId: sessionId as any,
            decision: "denied",
          });
        } catch (err: any) {
          console.error(`[execute-approved] Failed to update Convex to denied:`, err);
        }
      }
      return NextResponse.json({ status: "denied", message: "Execution denied by user." });
    }

    // 2. Handle Approved Execution
    if (!command) {
      return NextResponse.json({ error: "Command is required" }, { status: 400 });
    }

    console.log(`[execute-approved] Executing human-approved command in session ${sessionId}: ${command}`);

    if (convexClient) {
      try {
        await convexClient.mutation(api.hitl.submitDecisionForSession, {
          sessionId: sessionId as any,
          decision: "approved",
        });
      } catch (err: any) {
        console.error(`[execute-approved] Failed to update Convex to approved:`, err);
      }
    }

    try {
      // Reuse the persistent sandbox from the chat session
      const sandbox = await getOrCreateSandbox(sessionId);
      const result = await sandbox.commands.run(command, { timeoutMs: 55000 });
      
      // Store log
      addSandboxLog(sessionId, command, result.stdout + (result.stderr ? "\n" + result.stderr : ""));

      console.log(`[execute-approved] Execution completed: exit code ${result.exitCode}`);
      return NextResponse.json({ stdout: result.stdout, stderr: result.stderr });
    } catch (err: any) {
      console.error(`[execute-approved] E2B execution error:`, err);
      // Store failed log
      addSandboxLog(sessionId, command, `ERROR: ${err.message}`);
      return NextResponse.json({ error: err.message || "Failed to execute in sandbox" }, { status: 500 });
    }
  } catch (err: any) {
    console.error(`[execute-approved] Request parsing error:`, err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
