import { Sandbox } from "@e2b/code-interpreter";
import { getUserIDAndPro } from "@/lib/auth/get-user-id";
import { NextRequest } from "next/server";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { userId, subscription } = await getUserIDAndPro(req);

    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Only allow subscribed users to delete sandboxes
    if (subscription === "free") {
      return new Response(JSON.stringify({ error: "Subscription required" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    // List all sandboxes for this user
    const paginator = Sandbox.list({
      query: {
        metadata: {
          userID: userId,
        },
      },
    });

    const sandboxes = await paginator.nextItems();

    // Kill each sandbox in parallel to prevent stalling and handle errors gracefully
    const results = await Promise.allSettled(
      sandboxes.map((sandbox) => Sandbox.kill(sandbox.sandboxId))
    );

    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length > 0) {
      failures.forEach((f, idx) => {
        console.error(`Failed to kill sandbox:`, (f as PromiseRejectedResult).reason);
      });
      return new Response(
        JSON.stringify({
          success: false,
          error: `${failures.length} sandboxes failed to delete`,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error deleting sandboxes:", error);
    return new Response(
      JSON.stringify({ error: "Failed to delete sandboxes" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
