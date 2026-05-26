import { NextResponse } from "next/server";
import { getFileChanges } from "@/lib/session-tracker";
import { validateRequest } from "@/lib/auth";

export async function GET(req: Request) {
  const authError = validateRequest(req);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId") ?? undefined;

  return NextResponse.json({ changes: getFileChanges(sessionId) });
}
