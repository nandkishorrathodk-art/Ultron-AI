/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getOrCreateSandbox, getDesktopStreamUrl } from "@/lib/sandbox-manager";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    const init = searchParams.get("init") === "true";

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 },
      );
    }

    if (init) {
      // Create or get desktop sandbox using the "desktop" template
      console.log(
        `[Ultron] Initializing desktop sandbox for session: ${sessionId}`,
      );
      await getOrCreateSandbox(sessionId, "desktop");
    }

    const streamUrl = getDesktopStreamUrl(sessionId);

    return NextResponse.json({
      success: true,
      sessionId,
      streamUrl,
      active: !!streamUrl,
    });
  } catch (err: any) {
    console.error("[Ultron Desktop API] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
