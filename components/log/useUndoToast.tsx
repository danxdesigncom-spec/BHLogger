"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { UndoToast, type ToastEntry } from "./UndoToast";
import { useRepo } from "@/lib/data/repo-context";

/** Undo removes the entry on every device (QL-04, AT-02): soft delete, synced through the repo. */
export function useUndoToast() {
  const [toast, setToast] = useState<ToastEntry | null>(null);
  const repo = useRepo();
  const qc = useQueryClient();

  const dismiss = useCallback(() => setToast(null), []);
  const undo = useCallback(
    async (entryId: string) => {
      setToast(null);
      await repo.deleteEntry(entryId);
      for (const key of ["entries", "latest-entry", "pending"]) qc.invalidateQueries({ queryKey: [key] });
    },
    [repo, qc],
  );

  return {
    showToast: setToast,
    toastElement: <UndoToast toast={toast} onUndo={(id) => void undo(id)} onDismiss={dismiss} />,
  };
}
