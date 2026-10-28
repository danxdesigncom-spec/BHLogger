"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ChevronRight, Lightbulb } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { InsightsNav } from "@/components/insights/InsightsNav";
import { Sparkline } from "@/components/insights/charts";
import { MODULE_ICONS } from "@/components/log/LogSheet";
import { useHousehold } from "@/lib/context/household-provider";
import { useProfileSettings } from "@/lib/data/hooks";
import { useInsightsData } from "@/lib/insights/useInsightsData";
import { todayCards, type TodayCard } from "@/lib/insights/today";
import { hardestTimeOfDay } from "@/lib/insights/patterns";
import { bathroomTileLabel } from "@/lib/options";
import { addDays, startOfDay } from "@/lib/dates";

const CARD_BG: Record<TodayCard["module"], string> = {
  bathroom: "bg-bathroom", eating: "bg-eating", mood: "bg-mood", medication: "bg-medication", activity: "bg-activity", behaviors: "bg-behavior",
};
const CARD_INK: Record<TodayCard["module"], string> = {
  bathroom: "text-bathroom-ink", eating: "text-eating-ink", mood: "text-mood-ink", medication: "text-medication-ink", activity: "text-activity-ink", behaviors: "text-behavior-ink",
};
const TREND_MODULE: Record<TodayCard["module"], string> = {
  bathroom: "bathroom", eating: "eating", mood: "mood", medication: "medication", activity: "activity", behaviors: "behaviors",
};

export default function InsightsTodayPage() {
  const { activeProfile, householdSettings } = useHousehold();
  const settings = useProfileSettings(activeProfile?.id ?? null);
  const now = useMemo(() => new Date(), []);
  const from = useMemo(() => startOfDay(addDays(now, -29)), [now]);
  const data = useInsightsData(from, now);

  const stage = activeProfile?.careStage ?? "child";
  const cards = todayCards({
    entries: data.all,
    meds: data.meds.map((m) => ({ ...m, default_dose: Number(m.default_dose) })),
    stage,
    enabled: activeProfile?.enabledModules ?? [],
    bmAlertDays: settings.bm_alert_days,
    volumeUnit: householdSettings.volume_unit,
    bathroomLabel: bathroomTileLabel(stage, activeProfile?.toileting ?? "toilet"),
    now,
  });
  const pattern = hardestTimeOfDay(data.inRange);

  return (
    <>
      <AppHeader title="Insights">
        <InsightsNav />
      </AppHeader>
      <div className="px-5 pt-3 pb-6 space-y-3">
        {data.loading ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3" aria-busy="true">
            {Array.from({ length: 6 }, (_, i) => <div key={i} className="min-h-[150px] rounded-card bg-muted animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {cards.map((c) => (
              <Link
                key={c.module}
                href={`/insights/trends?module=${TREND_MODULE[c.module]}`}
                className={`min-h-[150px] flex flex-col justify-between gap-2 p-4 rounded-card text-foreground ${CARD_BG[c.module]}`}
              >
                <span className={`flex items-center gap-1.5 text-label font-extrabold ${CARD_INK[c.module]} [&_svg]:w-4 [&_svg]:h-4`}>
                  {c.module === "behaviors" ? MODULE_ICONS.mood : MODULE_ICONS[c.module]}
                  {c.label}
                </span>{" "}
                <span className="flex flex-col gap-0.5">
                  <span className="font-display text-display-2">{c.value}</span>{" "}
                  <span className="text-label font-bold text-foreground-2">{c.caption}</span>{" "}
                  {c.sparkline && c.sparkline.length > 1 && <Sparkline values={c.sparkline} />}
                  {c.footnote && (
                    <span className={c.alert ? "self-start mt-1 px-2 py-0.5 rounded-full bg-card text-caption font-extrabold text-warning-ink" : "text-caption text-foreground-2"}>
                      {c.footnote}
                    </span>
                  )}
                </span>
              </Link>
            ))}
          </div>
        )}

        {pattern.status === "ready" && (
          <Link href="/insights/patterns" className="flex items-center gap-3 p-4 rounded-card bg-card shadow-card">
            <span className="w-11 h-11 flex-none rounded-full bg-profile-tint text-profile-ink flex items-center justify-center">
              <Lightbulb size={20} strokeWidth={2} aria-hidden="true" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-body-md">New pattern: {pattern.hardest.label} is hardest</span>
              <span className="block text-caption text-muted-foreground">See what we noticed this month</span>
            </span>
            <ChevronRight size={20} strokeWidth={2} aria-hidden="true" />
          </Link>
        )}
      </div>
    </>
  );
}
