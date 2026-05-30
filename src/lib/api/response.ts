import { NextResponse } from "next/server";

export const json = (data: unknown, init?: ResponseInit) =>
  NextResponse.json(data, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...(init?.headers || {}),
    },
  });

export const extractErrorMessage = (err: unknown): string => {
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err) {
    return (err as Error).message ?? "";
  }
  return "";
};

export const isUnauthorizedError = (err: unknown): boolean => {
  const normalized = extractErrorMessage(err).toLowerCase();
  return (
    normalized.includes("invalid_grant") ||
    normalized.includes("session has already ended") ||
    normalized.includes("no session cookie") ||
    normalized.includes("unauthorized")
  );
};

export const isRateLimitError = (err: unknown): boolean => {
  const normalized = extractErrorMessage(err).toLowerCase();
  // Detect common 429 shapes, WorkOS SDK message, and nested cause (TokenRefreshError wraps RateLimitExceededException)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const statusCode = (err as any)?.status;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const causeStatusCode = (err as any)?.cause?.status;
  return (
    statusCode === 429 ||
    causeStatusCode === 429 ||
    normalized.includes("rate limit exceeded") ||
    normalized.includes("too many requests")
  );
};
