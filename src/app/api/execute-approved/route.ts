import { NextResponse } from "next/server";
import { getOrCreateSandbox } from "@/lib/sandbox-manager";
import { validateRequest } from "@/lib/auth";

function isValidUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
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

    if (!isValidUUID(approvalToken)) {
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
