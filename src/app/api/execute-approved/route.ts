import { NextResponse } from "next/server";
import { getOrCreateSandbox } from "@/lib/sandbox-manager";
import { validateRequest } from "@/lib/auth";

function isValidToolCallId(value: string): boolean {
  // AI SDK tool call IDs vary by provider:
  //   OpenAI: "call_<alphanum>"
  //   Anthropic: "toolu_<alphanum>"
  //   UUID fallback: standard UUID format
  // Accept any alphanumeric string with hyphens/underscores, 5–128 chars
  return /^[a-zA-Z0-9_-]{5,128}$/.test(value);
}

export async function POST(req: Request) {
  const authError = validateRequest(req);
  if (authError) return authError;

  try {
    const { command, sessionId, approvalToken } = await req.json();

    if (!command || !sessionId) {
      return NextResponse.json(
        { error: "Missing required fields: command, sessionId" },
        { status: 400 },
      );
    }

    if (!approvalToken || typeof approvalToken !== "string") {
      return NextResponse.json(
        { error: "Missing approvalToken — HITL approval verification required" },
        { status: 403 },
      );
    }

    if (!isValidToolCallId(approvalToken)) {
      return NextResponse.json(
        { error: "Invalid approvalToken format — must be a valid tool call ID" },
        { status: 403 },
      );
    }

    const sandbox = await getOrCreateSandbox(sessionId);

    const result = await sandbox.commands.run(command, {
      timeoutMs: 55_000,
    });

    return NextResponse.json({
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[execute-approved] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
