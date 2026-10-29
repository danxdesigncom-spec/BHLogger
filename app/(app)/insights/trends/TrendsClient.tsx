"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AppHeader } from "@/components/layout/AppHeader";
import { InsightsNav } from "@/components/insights/InsightsNav";
import { ChartCard } from "@/components/insights/ChartCard";
import { buildTrendCards, type TrendModule } from "@/components/insights/trendCards";
import { RadioChips, Segmented } from "@/components/log/controls";
import { useHousehold } from "@/lib/context/household-provider";
import { useProfileSettings } from "@/lib/data/hooks";
import { useOptionLabels } from "@/lib/data/useOptionSet";
import { useInsightsData, useInsightsRange, type RangeKey } from "@/lib/insights/useInsightsData";
import { bathroomTileLabel } from "@/lib/options";
import { shortDate } from "@/lib/dates";
import { ymdLocal } from "@/lib/insights/core";

const MODULES = ["all", "mood", "bathroom", "behaviors", "eating", "activity", "medication"] as const;
type Mod = (typeof MODULES)[number];

export function TrendsClient() {
  const { activeProfile, householdSettings } = useHousehold();
  const settings = useProfileSettings(activeProfile?.id ?? null);
  const optionLabel = useOptionLabels(activeProfile?.id ?? null);
  const router = useRouter();
  const tr = useTranslations();
  const t = useTranslations("insights.trends");
  const params = useSearchParams();
  const mod = (MODULES.includes(params.get("module") as Mod) ? params.get("module") : "all") as Mod;
  const { range, setRange, custom, setCustom, from, to } = useInsightsRange();
  const data = useInsightsData(from, to);

  const stage = activeProfile?.careStage ?? "child";
  const toileting = activeProfile?.toileting ?? "toilet";
  const enabled = new Set(activeProfile?.enabledModules ?? []);
  const available = (m: Mod) => (m === "behaviors" ? enabled.has("mood") && stage !== "baby" : enabled.has(m));
  const show = (m: TrendModule) => (mod === "all" || mod === m) && available(m);
  const rangeText = t("rangeText", { from: shortDate(from), to: shortDate(to) });

  const cards = buildTrendCards({
    inRange: data.inRange, previous: data.previous, days: data.days, from, to, markers: data.markers, meds: data.meds,
    stage, toileting, bmAlertDays: settings.bm_alert_days, volumeUnit: householdSettings.volume_unit,
    foodLabel: (key) => optionLabel("food", key), now: new Date(),
  }).filter((c) => show(c.module));

  const markerFooter = data.markers.length > 0 && (
    <ul className="flex flex-wrap gap-1.5">
      {data.markers.map((m) => (
        <li key={`${m.day}${m.label}`} className="px-2.5 py-1 rounded-full border border-dashed border-[var(--chart-marker)] text-micro font-extrabold text-[var(--chart-marker)]">
          {t("markerChip", { label: m.label, date: shortDate(new Date(`${m.day}T00:00:00`)) })}
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <AppHeader title={tr("insights.title")}>
        <InsightsNav />
      </AppHeader>

      <div className="px-5 pt-3 pb-6 space-y-3">
        <Segmented<RangeKey>
          label={t("range")}
          value={range}
          onChange={setRange}
          options={[{ value: "7", label: t("days", { count: 7 }) }, { value: "30", label: t("days", { count: 30 }) }, { value: "90", label: t("days", { count: 90 }) }, { value: "custom", label: t("custom") }]}
        />
        {range === "custom" && (
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-label text-muted-foreground">
              {t("from")}
              <input type="date" value={custom.from} max={custom.to} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className="h-button rounded-lg border border-input bg-card px-3 text-[16px] font-bold text-foreground" />
            </label>
            <label className="flex flex-col gap-1 text-label text-muted-foreground">
              {t("to")}
              <input type="date" value={custom.to} min={custom.from} max={ymdLocal(new Date())} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className="h-button rounded-lg border border-input bg-card px-3 text-[16px] font-bold text-foreground" />
            </label>
          </div>
        )}
        <div className="-mx-5 px-5 overflow-x-auto [scrollbar-width:none]">
          <div className="w-max">
            <RadioChips<Mod>
              label={t("module")}
              value={mod}
              onChange={(m) => router.replace(m === "all" ? "/insights/trends" : `/insights/trends?module=${m}`, { scroll: false })}
              options={MODULES.filter((m) => m === "all" || available(m)).map((m) => ({
                value: m,
                label: m === "all" ? t("all") : m === "bathroom" ? bathroomTileLabel(stage, toileting) : m === "medication" ? t("meds") : m === "behaviors" ? t("behaviors") : m === "eating" && stage === "baby" ? tr("modules.feeding") : tr(`modules.${m}`),
              }))}
            />
          </div>
        </div>

        {data.loading ? (
          <div className="space-y-3" aria-busy="true">{[0, 1].map((i) => <div key={i} className="h-64 rounded-card bg-muted animate-pulse" />)}</div>
        ) : (
          <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
            {cards.map((c) => (
              <ChartCard
                key={c.id}
                reportId={c.id}
                kicker={c.kicker}
                icon={c.icon}
                inkClass={c.inkClass}
                headline={c.headline}
                caption={c.caption}
                table={c.table}
                ariaRange={rangeText}
                footer={c.markers ? markerFooter : undefined}
              >
                {c.chart()}
              </ChartCard>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
