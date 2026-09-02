import { NextRequest, NextResponse } from "next/server";
import { localSandboxManager } from "@/lib/local-sandbox-manager";

/**
 * POST /api/sandbox/local/result
 * CLI submits command execution results.
 *
 * Body: { commandId, token, stdout, stderr, exitCode }
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { commandId, token, stdout, stderr, exitCode } = body;

  if (!commandId || !token) {
    return NextResponse.json(
      { success: false, error: "commandId and token required" },
      { status: 400 },
    );
  }

  if (!localSandboxManager.validateToken(token)) {
    return NextResponse.json(
      { success: false, error: "Invalid token" },
      { status: 401 },
    );
  }

  const ok = localSandboxManager.submitResult(commandId, {
    stdout: stdout ?? "",
    stderr: stderr ?? "",
    exitCode: exitCode ?? 1,
  });

  if (!ok) {
    return NextResponse.json(
      { success: false, error: "Unknown commandId or already resolved" },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true });
}
