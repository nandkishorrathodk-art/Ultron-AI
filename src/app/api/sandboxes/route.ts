import { NextResponse } from "next/server";
import { getActiveSandboxes } from "@/lib/sandbox-manager";
import { validateRequest } from "@/lib/auth";

export async function GET(req: Request) {
  const authError = await validateRequest(req);
  if (authError) return authError;

  const sandboxes = getActiveSandboxes();
  return NextResponse.json({ sandboxes });
}
