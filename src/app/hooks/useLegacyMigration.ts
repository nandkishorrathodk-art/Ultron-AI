"use client";

import React from "react";
import { toast } from "sonner";
import { useGlobalState } from "@/app/contexts/GlobalState";

type UseLegacyMigration = {
  isMigrating: boolean;
  migrate: () => Promise<void>;
};

export const useLegacyMigration = (): UseLegacyMigration => {
  const { setMigrateFromLegacyDialogOpen } = useGlobalState();
  const [isMigrating, setIsMigrating] = React.useState(false);

  const migrate = React.useCallback(async () => {
    if (isMigrating) return;
    setIsMigrating(true);
    try {
      const response = await fetch("/api/migrate-pentestgpt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.message || data.error || "Migration failed";
        toast.error(errorMessage);
        setMigrateFromLegacyDialogOpen(false);
        return;
      }

      toast.success("Migration complete. Updating your account...");

      try {
        const url = new URL(window.location.href);
        url.searchParams.set("refresh", "entitlements");
        url.searchParams.delete("confirm-migrate-legacy");
        if (data?.showTeamWelcome) {
          url.searchParams.set("team-welcome", "true");
        }
        window.location.replace(url.toString());
      } catch (urlErr) {
        console.warn(
          "Failed to set window location URL query search parameters:",
          urlErr,
        );
        try {
          await fetch("/api/entitlements", { credentials: "include" });
        } catch (fetchErr) {
          console.warn(
            "Failed to fetch entitlements during legacy migration fallback:",
            fetchErr,
          );
        }
        window.location.reload();
      }
    } catch (error) {
      toast.error("An unexpected error occurred during migration");
      setMigrateFromLegacyDialogOpen(false);
    } finally {
      setIsMigrating(false);
    }
  }, [isMigrating, setMigrateFromLegacyDialogOpen]);

  return { isMigrating, migrate };
};

export default useLegacyMigration;
