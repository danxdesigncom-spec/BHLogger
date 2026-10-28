"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { RadioChips } from "@/components/log/controls";
import { EntryRow } from "@/components/timeline/EntryRow";
import { EditEntrySheet } from "@/components/timeline/EditEntrySheet";
import { UndoToast, type ToastEntry } from "@/components/log/UndoToast";
import { useHousehold } from "@/lib/context/household-provider";
import { useEntries, useEntry, useMedications } from "@/lib/data/hooks";
import { useRepo } from "@/lib/data/repo-context";
import type { LocalEntry } from "@/lib/data/types";
import { entryShortLabel, type SummaryContext } from "@/lib/entries/summary";
import { bathroomTileLabel } from "@/lib/options";
import { daySummary, groupByDay } from "@/lib/timeline";
import { dayHeading, startOfDay } from "@/lib/dates";

const PAGE_DAYS = 7;

export function TimelineClient() {
  const { activeProfile, householdSettings } = useHousehold();
  const router = useRouter();
  const params = useSearchParams();
  const entryId = params.get("entry");
  const repo = useRepo();
  const qc = useQueryClient();

  const [filter, setFilter] = useState<string>("all");
  const [days, setDays] = useState(PAGE_DAYS);
  const [toast, setToast] = useState<ToastEntry | null>(null);
  const from = useMemo(() => startOfDay(new Date(Date.now() - (days - 1) * 86_400_000)).toISOString(), [days]);

  const types = filter === "all" ? undefined : [filter];
  const entries = useEntries({ profileId: activeProfile?.id, from, types }, !!activeProfile);
  const meds = useMedications(activeProfile?.id ?? null);
  const listed = (entries.data ?? []).find((e) => e.id === entryId);
  const direct = useEntry(entryId && !listed ? entryId : null);
  const editing = listed ?? direct.data ?? null;

  const stage = activeProfile?.careStage ?? "child";
  const ctx: SummaryContext = {
    careStage: stage, toileting: activeProfile?.toileting ?? "toilet", volumeUnit: householdSettings.volume_unit,
    medicationName: (id) => meds.data?.find((m) => m.id === id)?.name,
  };
  const groups = groupByDay(entries.data ?? []);
  const scheduledMeds = filter === "all" || filter === "medication" ? (meds.data ?? []) : [];

  // Day-by-day loading as the user scrolls (S10).
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((xs) => {
      if (xs.some((x) => x.isIntersecting) && !entries.isFetching && days < 90) setDays((d) => d + PAGE_DAYS);
    }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [entries.isFetching, days]);

  const open = (id: string) => router.replace(`/timeline?entry=${id}`, { scroll: false });
  const close = () => router.replace("/timeline", { scroll: false });

  const restore = async (id: string) => {
    setToast(null);
    await repo.restoreEntry(id);
    for (const key of ["entries", "latest-entry"]) qc.invalidateQueries({ queryKey: [key] });
  };

  return (
    <>
      <AppHeader title="Timeline">
        <div className="-mx-5 px-5 overflow-x-auto [scrollbar-width:none]">
          <div className="w-max">
            <RadioChips
              label="Filter by module"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "All" },
                { value: "bathroom", label: bathroomTileLabel(stage, activeProfile?.toileting ?? "toilet") },
                { value: "eating", label: stage === "baby" ? "Feeding" : "Eating" },
                { value: "mood", label: "Mood" },
                { value: "activity", label: "Activity" },
                { value: "medication", label: "Meds" },
              ]}
            />
          </div>
        </div>
      </AppHeader>

      <div className="px-5 pt-3 pb-6 space-y-5" aria-live="polite" aria-busy={entries.isLoading}>
        {entries.isLoading && <p className="text-body text-muted-foreground">Loading…</p>}
        {!entries.isLoading && groups.length === 0 && (
          <div className="rounded-card bg-card p-5 shadow-card">
            <p className="text-body-md">Nothing logged {filter === "all" ? "" : "here "}in the last {days} days</p>
            <p className="text-caption text-muted-foreground">Entries from every caregiver show up here as they&rsquo;re logged.</p>
          </div>
        )}

        {groups.map((g) => {
          const summary = daySummary(g.entries, g.day, scheduledMeds, stage);
          return (
            <section key={g.day.getTime()} aria-labelledby={`day-${g.day.getTime()}`} className="space-y-2">
              <div>
                <h2 id={`day-${g.day.getTime()}`} className="font-display text-title-4">{dayHeading(g.day)}</h2>
                {summary && <p className="text-caption font-bold text-muted-foreground">{summary}</p>}
              </div>
              <div className="rounded-card bg-card shadow-card divide-y divide-divider overflow-hidden">
                {g.entries.map((e) => <EntryRow key={e.id} entry={e} ctx={ctx} onOpen={() => open(e.id)} />)}
              </div>
            </section>
          );
        })}

        <div ref={sentinel} aria-hidden="true" />
        {groups.length > 0 && days >= 90 && <p className="text-caption text-muted-foreground text-center">Showing the last 90 days. Reports cover longer ranges.</p>}

        <Link href="/timeline/deleted" className="min-h-touch-min inline-flex items-center gap-2 text-label font-extrabold text-profile-ink">
          <Trash2 size={16} strokeWidth={2} aria-hidden="true" /> Recently deleted
        </Link>
      </div>

      {editing && (
        <EditEntrySheet
          key={editing.id}
          entry={editing}
          onClose={close}
          onDeleted={(e: LocalEntry) => {
            close();
            setToast({
              entryId: e.id, householdId: e.household_id, profileName: activeProfile?.name ?? "", summary: entryShortLabel(e, ctx),
              time: new Date(e.occurred_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
              message: `Deleted ${entryShortLabel(e, ctx).toLowerCase()} for ${activeProfile?.name ?? ""}`,
            });
          }}
        />
      )}
      <UndoToast toast={toast} onUndo={(id) => void restore(id)} onDismiss={() => setToast(null)} />
    </>
  );
}
