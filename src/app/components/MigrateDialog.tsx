"use client";

import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type MigrateLegacyDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMigrating: boolean;
  onConfirm: () => void;
};

export const MigrateLegacyDialog: React.FC<
  MigrateLegacyDialogProps
> = ({ open, onOpenChange, isMigrating, onConfirm }) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm migration</AlertDialogTitle>
          <AlertDialogDescription>
            Migrating will transfer your active legacy subscription to
            Ultron-AI. You will lose access to your previous plan. Do you
            want to continue?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isMigrating}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isMigrating}>
            {isMigrating ? "Migrating..." : "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default MigrateLegacyDialog;
