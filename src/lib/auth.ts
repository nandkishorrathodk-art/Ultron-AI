import { NextResponse } from "next/server";
import crypto from "crypto";
import { verifySessionToken } from "@/lib/session";

const GATEWAY_TOKEN = process.env.ULTRON_API_KEY || process.env.ULTRON_GATEWAY_TOKEN;

/**
 * Validate an incoming API request.
 * Accepts either:
 *   1. A matching `Authorization: Bearer <token>` header (API access), or
 *   2. A valid `ultron_session` cookie (browser access via proxy).
 * When no ULTRON_API_KEY is configured (local dev), all requests are allowed.
 */
export async function validateRequest(req: Request): Promise<NextResponse | null> {
  if (!GATEWAY_TOKEN) {
    return null; // no key configured — allow (local dev)
  }

  // Check Bearer token
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (token && timingSafeEqual(token, GATEWAY_TOKEN)) {
    return null; // authorized via Bearer token
  }

  // Fallback: check session cookie (browser requests authenticated by proxy)
  const cookieHeader = req.headers.get("cookie") ?? "";
  const sessionMatch = cookieHeader.match(/ultron_session=([^;]+)/);
  if (sessionMatch) {
    const session = await verifySessionToken(sessionMatch[1]);
    if (session) {
      return null; // authorized via session cookie
    }
  }

  return NextResponse.json(
    { error: "Unauthorized — provide a valid Bearer token or sign in" },
    { status: 401 },
  );
}

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Compare against self so the timing is constant regardless of length mismatch
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}
