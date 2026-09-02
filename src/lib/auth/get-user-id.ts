import type { NextRequest } from "next/server";
import { ChatSDKError } from "@/lib/errors";
import type { SubscriptionTier } from "@/types";
import {
  parseEntitlements,
  resolveSubscriptionTier,
} from "@/lib/auth/entitlements";

/**
 * Get the current user ID from the authenticated session
 * Throws ChatSDKError if user is not authenticated
 *
 * @param req - NextRequest object (server-side only)
 * @returns Promise<string> - User ID
 * @throws ChatSDKError - When user is not authenticated
 */
export const getUserID = async (req: NextRequest): Promise<string> => {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    throw new ChatSDKError("unauthorized:auth");
  }
  return userId;
};

/**
 * Get the current user ID and pro status from the authenticated session
 * Throws ChatSDKError if user is not authenticated
 *
 * @param req - NextRequest object (server-side only)
 * @returns Promise<{ userId: string; isPro: boolean; subscription: SubscriptionTier }> - Object with userId, isPro, and subscription
 * @throws ChatSDKError - When user is not authenticated
 */
export const getUserIDAndPro = async (
  req: NextRequest,
): Promise<{
  userId: string;
  subscription: SubscriptionTier;
  organizationId?: string;
}> => {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    throw new ChatSDKError("unauthorized:auth");
  }

  // Get subscription from headers
  let subscription = req.headers.get("x-user-subscription") as SubscriptionTier | null;

  if (!subscription || subscription === "free") {
    // Try to resolve from entitlements header if present
    const rawEntitlements = req.headers.get("x-user-entitlements");
    if (rawEntitlements) {
      try {
        const parsed = JSON.parse(rawEntitlements);
        const entitlements = parseEntitlements(parsed);
        subscription = resolveSubscriptionTier(entitlements);
      } catch {
        subscription = "free";
      }
    } else {
      subscription = "free";
    }
  }

  return {
    userId,
    subscription,
    organizationId: req.headers.get("x-user-org-id") || undefined,
  };
};

/**
 * Get the current user ID only if the user has signed in recently.
 * Throws ChatSDKError if unauthenticated.
 *
 * @param req - NextRequest object (server-side only)
 * @param windowMs - Freshness window in milliseconds (ignored in custom JWT)
 * @returns Promise<string> - User ID
 * @throws ChatSDKError - When user is not authenticated
 */
export const getUserIDWithFreshLogin = async (
  req: NextRequest,
  windowMs: number = 10 * 60 * 1000,
): Promise<string> => {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    throw new ChatSDKError("unauthorized:auth", "missing_session_user");
  }
  return userId;
};
