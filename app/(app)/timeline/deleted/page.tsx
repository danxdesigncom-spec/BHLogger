"use client";

import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { EntryRow } from "@/components/timeline/EntryRow";
import { useHousehold } from "@/lib/context/household-provider";
import { useEntries, useMedications } from "@/lib/data/hooks";
import { useRepo } from "@/lib/data/repo-context";
import type { SummaryContext } from "@/lib/entries/summary";

export default function RecentlyDeletedPage() {
  const { activeProfile, householdSettings, currentMember } = useHousehold();
  const repo = useRepo();
  const qc = useQueryClient();
  const since = useMemo(() => new Date(Date.now() - 30 * 86_400_000).toISOString(), []);
  const deleted = useEntries({ profileId: activeProfile?.id, deleted: "only" }, !!activeProfile);
  const meds = useMedications(activeProfile?.id ?? null);
  const ctx: SummaryContext = {
    careStage: activeProfile?.careStage ?? "child", toileting: activeProfile?.toileting ?? "toilet", volumeUnit: householdSettings.volume_unit,
    medicationName: (id) => meds.data?.find((m) => m.id === id)?.name,
  };
  const rows = (deleted.data ?? []).filter((e) => (e.deleted_at ?? "") >= since);
  const canRestore = (loggedBy: string) => currentMember.role === "admin" || (currentMember.role === "caregiver" && loggedBy === currentMember.userId);

  return (
    <>
      <PageHeader title="Recently deleted" subtitle={`for ${activeProfile?.name ?? ""} · last 30 days`} backHref="/timeline" backLabel="Back to Timeline" />
      <div className="px-5 pt-3 pb-6">
        {deleted.isLoading ? (
          <p className="text-body text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-body text-muted-foreground">Nothing deleted in the last 30 days.</p>
        ) : (
          <div className="rounded-card bg-card shadow-card divide-y divide-divider">
            {rows.map((e) => (
              <EntryRow
                key={e.id}
                entry={e}
                ctx={ctx}
                action={
                  canRestore(e.logged_by) ? (
                    <button
                      type="button"
                      onClick={async () => {
                        await repo.restoreEntry(e.id);
                        for (const key of ["entries", "latest-entry"]) qc.invalidateQueries({ queryKey: [key] });
                      }}
                      className="flex-none min-h-touch-min px-4 rounded-full bg-primary text-primary-foreground text-label font-extrabold"
                    >
                      Restore
                    </button>
                  ) : undefined
                }
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
