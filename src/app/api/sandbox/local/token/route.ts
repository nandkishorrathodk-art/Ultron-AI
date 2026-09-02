import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { localSandboxManager } from "@/lib/local-sandbox-manager";

/**
 * GET /api/sandbox/local/token
 * Returns the local sandbox token for the authenticated admin.
 * This token is used by the CLI to connect in direct mode.
 */
export async function GET(request: NextRequest) {
  void request;
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 },
    );
  }

  return NextResponse.json({
    token: localSandboxManager.getSandboxToken(),
    usage:
      "npx @ultron-ai/local --direct http://localhost:3000 --token <TOKEN>",
  });
}
