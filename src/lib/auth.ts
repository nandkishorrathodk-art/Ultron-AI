import { NextResponse } from "next/server";
import crypto from "crypto";

const GATEWAY_TOKEN = process.env.ULTRON_API_KEY || process.env.ULTRON_GATEWAY_TOKEN;

/**
 * Validate an incoming API request.
 * If ULTRON_API_KEY is set, the request must include a matching
 * `Authorization: Bearer <token>` header. When no key is configured
 * (local dev), all requests are allowed.
 */
export function validateRequest(req: Request): NextResponse | null {
  if (!GATEWAY_TOKEN) {
    return null; // no key configured — allow (local dev)
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token || !timingSafeEqual(token, GATEWAY_TOKEN)) {
    return NextResponse.json(
      { error: "Unauthorized — provide a valid Bearer token via the Authorization header" },
      { status: 401 },
    );
  }

  return null; // authorized
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
