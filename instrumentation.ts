import { phLogger } from "@/lib/posthog/server";
import { assertEnvironmentValid } from "@/lib/validation/env";
import type { Instrumentation } from "next";

// Validate environment on startup
try {
  assertEnvironmentValid();
  console.log("✅ Environment validation passed");
} catch (error) {
  console.error("❌ Startup failed due to environment validation error:");
  console.error(error);
  process.exit(1);
}

export const onRequestError: Instrumentation.onRequestError = (
  error,
  request,
  context,
) => {
  phLogger.error("Next.js request error", {
    error,
    path: request.path,
    method: request.method,
    routePath: context.routePath,
    routeType: context.routeType,
    routerKind: context.routerKind,
  });
};
