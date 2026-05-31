import { NextRequest, NextResponse } from "next/server";
import { localSandboxManager } from "@/lib/local-sandbox-manager";

/**
 * POST /api/sandbox/local/connect
 * Register a new local sandbox connection.
 *
 * Body: { token, name, osInfo?, capabilities? }
 * Returns: { success, connectionId } or { success: false, error }
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { token, name, osInfo, capabilities } = body;

  if (!token) {
    return NextResponse.json(
      { success: false, error: "Token required" },
      { status: 400 },
    );
  }

  const conn = localSandboxManager.register(
    token,
    name || "local",
    osInfo,
    capabilities,
  );

  if (!conn) {
    return NextResponse.json(
      { success: false, error: "Invalid token" },
      { status: 401 },
    );
  }

  return NextResponse.json({
    success: true,
    connectionId: conn.connectionId,
    message: "Connected. Open SSE stream to start receiving commands.",
  });
}

/**
 * GET /api/sandbox/local/connect
 * List active local sandbox connections.
 */
export async function GET() {
  const connections = localSandboxManager.listConnections().map((conn) => ({
    connectionId: conn.connectionId,
    name: conn.name,
    osInfo: conn.osInfo,
    capabilities: conn.capabilities,
    connectedAt: conn.connectedAt,
    lastActivity: conn.lastActivity,
    isDesktop: conn.isDesktop,
    streamReady: conn.streamReady,
  }));

  return NextResponse.json({ connections });
}

/**
 * DELETE /api/sandbox/local/connect
 * Disconnect a local sandbox connection.
 *
 * Body: { connectionId, token }
 */
export async function DELETE(request: NextRequest) {
  const body = await request.json();
  const { connectionId, token } = body;

  if (!connectionId || !token) {
    return NextResponse.json(
      { success: false, error: "connectionId and token required" },
      { status: 400 },
    );
  }

  if (!localSandboxManager.validateToken(token)) {
    return NextResponse.json(
      { success: false, error: "Invalid token" },
      { status: 401 },
    );
  }

  const ok = localSandboxManager.disconnect(connectionId);
  return NextResponse.json({ success: ok });
}
