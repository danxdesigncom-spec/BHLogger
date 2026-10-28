"use client";

import { useEffect, useMemo, useState } from "react";
import { useHousehold } from "@/lib/context/household-provider";
import { useEntries, useMedicationChanges, useMedications } from "@/lib/data/hooks";
import { startOfDay, addDays } from "@/lib/dates";
import { eachDay, ymdLocal } from "./core";
import { t } from "@/lib/i18n";

const MARKER_KEY: Record<string, string> = { started: "markerStarted", stopped: "markerStopped", dose_changed: "markerDose", schedule_changed: "markerSchedule" };

export type RangeKey = "7" | "30" | "90" | "custom";
const KEY = "bl-insights-range";

/** DSH-02: the range persists while moving between modules (and across visits on this device). */
export function useInsightsRange() {
  const [range, setRangeState] = useState<RangeKey>("30");
  const [custom, setCustom] = useState<{ from: string; to: string }>(() => ({ from: ymdLocal(addDays(new Date(), -13)), to: ymdLocal(new Date()) }));

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
      if (saved?.range) setRangeState(saved.range);
      if (saved?.custom) setCustom(saved.custom);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const save = (r: RangeKey, c = custom) => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ range: r, custom: c }));
    } catch {
      /* storage unavailable */
    }
  };

  // One "now" per mount, so the query key (and the charts) stay stable across renders.
  const [now] = useState(() => new Date());
  const { from, to } = useMemo(() => ({
    to: range === "custom" ? new Date(`${custom.to}T23:59:59`) : now,
    from: range === "custom" ? new Date(`${custom.from}T00:00:00`) : startOfDay(addDays(now, -(Number(range) - 1))),
  }), [range, custom, now]);

  return {
    range,
    custom,
    from,
    to,
    setRange: (r: RangeKey) => {
      setRangeState(r);
      save(r);
    },
    setCustom: (c: { from: string; to: string }) => {
      setCustom(c);
      save("custom", c);
    },
  };
}

/** Entries for the range plus the same length before it (DSH-10 comparisons), meds and change markers. */
export function useInsightsData(from: Date, to: Date) {
  const { activeProfile } = useHousehold();
  const span = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000));
  const loadFrom = useMemo(() => addDays(from, -span).toISOString(), [from, span]);
  const entries = useEntries({ profileId: activeProfile?.id, from: loadFrom }, !!activeProfile);
  const meds = useMedications(activeProfile?.id ?? null);
  const changes = useMedicationChanges(activeProfile?.id ?? null);

  const days = useMemo(() => eachDay(from, to), [from, to]);
  const prevFrom = addDays(from, -span);
  const all = entries.data ?? [];
  const inRange = all.filter((e) => e.occurred_at >= from.toISOString() && e.occurred_at <= to.toISOString());
  const previous = all.filter((e) => e.occurred_at >= prevFrom.toISOString() && e.occurred_at < from.toISOString());

  const medName = (id: string) => meds.data?.find((m) => m.id === id)?.name ?? t("modules.medication");
  const markers = (changes.data ?? [])
    .filter((c) => c.effective_at >= days[0] && c.effective_at <= days[days.length - 1])
    .map((c) => ({
      day: c.effective_at,
      label: t(`insights.trends.${MARKER_KEY[c.change_type] ?? "markerSchedule"}`, { name: medName(c.medication_id) }),
      change: c,
    }));

  return {
    loading: entries.isLoading || meds.isLoading,
    days,
    inRange,
    previous,
    all,
    meds: meds.data ?? [],
    changes: changes.data ?? [],
    markers,
    medName,
  };
}
