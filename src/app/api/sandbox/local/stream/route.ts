import { NextRequest } from "next/server";
import { localSandboxManager } from "@/lib/local-sandbox-manager";

/**
 * GET /api/sandbox/local/stream?connectionId=X&token=Y
 * SSE endpoint for CLI to receive commands in real-time.
 *
 * The CLI keeps this connection open. When a command is dispatched
 * via localSandboxManager.executeCommand(), it's pushed here.
 */
export async function GET(request: NextRequest) {
  const connectionId = request.nextUrl.searchParams.get("connectionId");
  const token = request.nextUrl.searchParams.get("token");

  if (!connectionId || !token) {
    return new Response("connectionId and token required", { status: 400 });
  }

  if (!localSandboxManager.validateToken(token)) {
    return new Response("Invalid token", { status: 401 });
  }

  const conn = localSandboxManager.getConnection(connectionId);
  if (!conn) {
    return new Response("Connection not found", { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      localSandboxManager.markStreamReady(connectionId);

      // Send initial connected event
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: "connected", connectionId })}\n\n`,
        ),
      );

      // Listen for commands
      const onCommand = (data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          // Stream closed
        }
      };

      // Send keepalive pings every 15s
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(pingInterval);
        }
      }, 15_000);

      // Listen for disconnect signal
      const onDisconnect = () => {
        clearInterval(pingInterval);
        localSandboxManager.removeListener(
          `command:${connectionId}`,
          onCommand,
        );
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      localSandboxManager.on(`command:${connectionId}`, onCommand);
      localSandboxManager.once(`disconnect:${connectionId}`, onDisconnect);

      // Handle client abort
      request.signal.addEventListener("abort", () => {
        clearInterval(pingInterval);
        localSandboxManager.removeListener(
          `command:${connectionId}`,
          onCommand,
        );
        localSandboxManager.removeListener(
          `disconnect:${connectionId}`,
          onDisconnect,
        );
        localSandboxManager.markStreamClosed(connectionId);
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
