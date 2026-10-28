"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useHousehold } from "@/lib/context/household-provider";
import { createClient } from "@/lib/supabase/client";
import { createDemoRepo } from "./demo-repo";
import { createLiveRepo } from "./live-repo";
import { outbox } from "./outbox";
import type { Repo } from "./types";

const RepoContext = createContext<Repo | null>(null);

export const DATA_KEYS = ["entries", "latest-entry", "pending", "revisions", "medications", "med-changes", "appointments", "options", "profile-settings"];

export function RepoProvider({ children }: { children: ReactNode }) {
  const { mode, householdId, currentMember } = useHousehold();
  const qc = useQueryClient();

  const repo = useMemo(() => {
    const actor = { userId: currentMember.userId, name: currentMember.displayName, initials: currentMember.initials, role: currentMember.role };
    return mode === "demo" ? createDemoRepo(actor) : createLiveRepo(actor, householdId);
  }, [mode, householdId, currentMember]);

  useEffect(() => {
    if (mode !== "live") return;
    const refresh = () => {
      for (const key of ["entries", "latest-entry", "pending"]) qc.invalidateQueries({ queryKey: [key] });
    };
    const unsubscribe = outbox.subscribe(refresh);
    void outbox.flush();

    // TL-03: entries from other caregivers appear without a refresh.
    const supabase = createClient();
    const channel = supabase
      .channel(`household:${householdId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "entries", filter: `household_id=eq.${householdId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "medications", filter: `household_id=eq.${householdId}` }, () => {
        qc.invalidateQueries({ queryKey: ["medications"] });
        qc.invalidateQueries({ queryKey: ["med-changes"] });
      })
      .subscribe();

    return () => {
      unsubscribe();
      void supabase.removeChannel(channel);
    };
  }, [mode, householdId, qc]);

  return <RepoContext.Provider value={repo}>{children}</RepoContext.Provider>;
}

export function useRepo(): Repo {
  const repo = useContext(RepoContext);
  if (!repo) throw new Error("useRepo must be used within RepoProvider");
  return repo;
}
