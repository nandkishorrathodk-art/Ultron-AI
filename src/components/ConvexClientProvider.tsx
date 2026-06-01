"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

const url =
  process.env.NEXT_PUBLIC_CONVEX_URL || "https://placeholder.convex.cloud";
const convex = new ConvexReactClient(url);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  // Always wrap in ConvexProvider so useQuery hooks don't throw.
  // When using placeholder URL, queries return undefined (no connection).
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
