"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/layout/AppHeader";
import { InsightsNav } from "@/components/insights/InsightsNav";
import { ChartCard } from "@/components/insights/ChartCard";
import { DailyBars, DoseTimes, LabeledBars, MoodLine, TopBars } from "@/components/insights/charts";
import { RadioChips, Segmented } from "@/components/log/controls";
import { MODULE_ICONS } from "@/components/log/LogSheet";
import { useHousehold } from "@/lib/context/household-provider";
import { useProfileSettings } from "@/lib/data/hooks";
import { useInsightsData, useInsightsRange, type RangeKey } from "@/lib/insights/useInsightsData";
import { activityTrend, bathroomTrend, behaviorTrend, eatingTrend, medsTrend, moodTrend } from "@/lib/insights/trends";
import { bathroomTileLabel } from "@/lib/options";
import { shortDate } from "@/lib/dates";
import { ymdLocal } from "@/lib/insights/core";

const MODULES = ["all", "mood", "bathroom", "behaviors", "eating", "activity", "medication"] as const;
type Mod = (typeof MODULES)[number];

// Sequential, one hue, three steps: lower mood is deeper. Each step keeps text at 4.5:1 or better in
// light and dark themes, and every cell prints its value, so color is never the only cue.
function heatStyle(avg: number | null): React.CSSProperties {
  if (avg === null) return { background: "var(--secondary)", color: "var(--muted-foreground)" };
  if (avg < 2.5) return { background: "var(--chart-mood)", color: "var(--primary-foreground)" };
  if (avg < 3.5) return { background: "color-mix(in oklab, var(--chart-mood) 30%, var(--card))", color: "var(--foreground)" };
  return { background: "color-mix(in oklab, var(--chart-mood) 10%, var(--card))", color: "var(--foreground)" };
}

function Heatmap({ rows }: { rows: { block: string; cells: { weekday: string; avg: number | null; n: number }[] }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed border-separate border-spacing-[3px] text-micro tabular-nums">
        <thead>
          <tr>
            <th scope="col" className="w-[58px]"><span className="sr-only">Time of day</span></th>
            {rows[0]?.cells.map((c) => <th key={c.weekday} scope="col" className="font-extrabold text-muted-foreground">{c.weekday}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.block}>
              <th scope="row" className="w-[58px] text-left font-extrabold text-muted-foreground whitespace-nowrap">{r.block}</th>
              {r.cells.map((c) => (
                <td
                  key={c.weekday}
                  className="h-8 rounded-md text-center font-extrabold"
                  style={heatStyle(c.avg)}
                  aria-label={`${r.block}, ${c.weekday}: ${c.avg ?? "no logs"}`}
                >
                  {c.avg ?? "·"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TrendsClient() {
  const { activeProfile, householdSettings } = useHousehold();
  const settings = useProfileSettings(activeProfile?.id ?? null);
  const router = useRouter();
  const params = useSearchParams();
  const mod = (MODULES.includes(params.get("module") as Mod) ? params.get("module") : "all") as Mod;
  const { range, setRange, custom, setCustom, from, to } = useInsightsRange();
  const data = useInsightsData(from, to);

  const stage = activeProfile?.careStage ?? "child";
  const toileting = activeProfile?.toileting ?? "toilet";
  const enabled = new Set(activeProfile?.enabledModules ?? []);
  const available = (m: Mod) => (m === "behaviors" ? enabled.has("mood") && stage !== "baby" : enabled.has(m));
  const show = (m: Mod) => (mod === "all" || mod === m) && available(m);
  const rangeText = `${shortDate(from)} to ${shortDate(to)}`;
  const now = new Date();

  const mood = moodTrend(data.inRange, data.previous, data.days, data.markers, stage);
  const bath = bathroomTrend(data.inRange, data.previous, data.days, from, to, stage, toileting, settings.bm_alert_days);
  const beh = behaviorTrend(data.inRange, data.previous, data.days, data.markers);
  const eat = eatingTrend(data.inRange, data.days, householdSettings.volume_unit);
  const act = activityTrend(data.inRange, data.days);
  const meds = medsTrend(data.inRange, data.days, from, to, data.meds.map((m) => ({ ...m })), now);

  const markerFooter = data.markers.length > 0 && (
    <ul className="flex flex-wrap gap-1.5">
      {data.markers.map((m) => (
        <li key={`${m.day}${m.label}`} className="px-2.5 py-1 rounded-full border border-dashed border-[var(--chart-marker)] text-micro font-extrabold text-[var(--chart-marker)]">
          {m.label} · {shortDate(new Date(`${m.day}T00:00:00`))}
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <AppHeader title="Insights">
        <InsightsNav />
      </AppHeader>

      <div className="px-5 pt-3 pb-6 space-y-3">
        <Segmented<RangeKey>
          label="Date range"
          value={range}
          onChange={setRange}
          options={[{ value: "7", label: "7 days" }, { value: "30", label: "30 days" }, { value: "90", label: "90 days" }, { value: "custom", label: "Custom" }]}
        />
        {range === "custom" && (
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-label text-muted-foreground">
              From
              <input type="date" value={custom.from} max={custom.to} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className="h-button rounded-lg border border-input bg-card px-3 text-[16px] font-bold text-foreground" />
            </label>
            <label className="flex flex-col gap-1 text-label text-muted-foreground">
              To
              <input type="date" value={custom.to} min={custom.from} max={ymdLocal(new Date())} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className="h-button rounded-lg border border-input bg-card px-3 text-[16px] font-bold text-foreground" />
            </label>
          </div>
        )}
        <div className="-mx-5 px-5 overflow-x-auto [scrollbar-width:none]">
          <div className="w-max">
            <RadioChips<Mod>
              label="Module"
              value={mod}
              onChange={(m) => router.replace(m === "all" ? "/insights/trends" : `/insights/trends?module=${m}`, { scroll: false })}
              options={MODULES.filter((m) => m === "all" || available(m)).map((m) => ({
                value: m,
                label: m === "all" ? "All" : m === "bathroom" ? bathroomTileLabel(stage, toileting) : m === "medication" ? "Meds" : m === "eating" && stage === "baby" ? "Feeding" : m.charAt(0).toUpperCase() + m.slice(1),
              }))}
            />
          </div>
        </div>

        {data.loading ? (
          <div className="space-y-3" aria-busy="true">{[0, 1].map((i) => <div key={i} className="h-64 rounded-card bg-muted animate-pulse" />)}</div>
        ) : (
          <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
            {show("mood") && (
              <ChartCard kicker="Mood" icon={MODULE_ICONS.mood} inkClass="text-mood-ink" headline={mood.headline} caption={mood.caption} table={mood.table} ariaRange={rangeText} footer={markerFooter}>
                <MoodLine data={mood.daily} markers={data.markers} averages={mood.averages} />
              </ChartCard>
            )}
            {show("mood") && mood.logCount > 0 && (
              <ChartCard
                kicker="Mood by time of day"
                icon={MODULE_ICONS.mood}
                inkClass="text-mood-ink"
                headline="When the day goes better or harder"
                caption="Average mood per 3-hour block and weekday · deeper color is lower (under 2.5, 2.5 to 3.4, 3.5 and up)"
                ariaRange={rangeText}
              >
                <Heatmap rows={mood.heatmap} />
              </ChartCard>
            )}
            {show("mood") && mood.feelings.length > 0 && (
              <ChartCard kicker="Feelings" icon={MODULE_ICONS.mood} inkClass="text-mood-ink" headline={`${mood.feelings[0].label} came up most`} caption={`${mood.logCount} mood logs`} table={{ columns: ["Feeling", "Times"], rows: mood.feelings.map((f) => [f.label, f.value]) }} ariaRange={rangeText}>
                <TopBars data={mood.feelings} color="var(--chart-2)" />
              </ChartCard>
            )}

            {show("bathroom") && (
              <ChartCard kicker={bathroomTileLabel(stage, toileting)} icon={MODULE_ICONS.bathroom} inkClass="text-bathroom-ink" headline={bath.headline} caption={bath.caption} table={bath.table} ariaRange={rangeText} footer={markerFooter}>
                <DailyBars data={bath.series} color="var(--chart-1)" bands={bath.bands} markers={data.markers} average unit={(v) => `${v} BM${v === 1 ? "" : "s"}`} />
              </ChartCard>
            )}
            {show("bathroom") && bath.wet && bath.wet.some((w) => w.count) && (
              <ChartCard kicker="Wet diapers" icon={MODULE_ICONS.bathroom} inkClass="text-bathroom-ink" headline={`About ${Math.round(bath.wet.reduce((s, w) => s + w.count, 0) / bath.wet.length)} wet diapers a day`} table={{ columns: ["Day", "Wet"], rows: bath.wet.map((w) => [shortDate(new Date(`${w.day}T00:00:00`)), w.count]) }} ariaRange={rangeText}>
                <DailyBars data={bath.wet.map((w) => ({ day: w.day, value: w.count }))} color="var(--chart-1)" unit={(v) => `${v} wet`} />
              </ChartCard>
            )}
            {show("bathroom") && bath.training && (
              <ChartCard kicker="Potty training" icon={MODULE_ICONS.bathroom} inkClass="text-bathroom-ink" headline={`${bath.training.reduce((s, d) => s + d.toilet, 0)} times on the toilet, ${bath.training.reduce((s, d) => s + d.accident, 0)} accidents`} table={{ columns: ["Day", "Toilet", "Accident"], rows: bath.training.map((d) => [shortDate(new Date(`${d.day}T00:00:00`)), d.toilet, d.accident]) }} ariaRange={rangeText}>
                <DailyBars data={bath.training.map((d) => ({ day: d.day, value: d.accident }))} color="var(--chart-highlight)" unit={(v) => `${v} accidents`} />
              </ChartCard>
            )}
            {show("bathroom") && bath.consistency.length > 0 && (
              <ChartCard kicker="Consistency" icon={MODULE_ICONS.bathroom} inkClass="text-bathroom-ink" headline={`Most often ${bath.consistency[0].label.toLowerCase()}`} table={{ columns: ["Consistency", "BMs"], rows: bath.consistency.map((c) => [c.label, c.value]) }} ariaRange={rangeText}>
                <TopBars data={bath.consistency} color="var(--chart-1)" />
              </ChartCard>
            )}

            {show("behaviors") && (
              <ChartCard kicker="Behaviors" icon={MODULE_ICONS.mood} inkClass="text-behavior-ink" headline={beh.headline} caption={beh.caption} table={beh.table} ariaRange={rangeText} footer={markerFooter}>
                <DailyBars data={beh.series} color="var(--chart-highlight)" markers={data.markers} unit={(v) => `${v} behavior${v === 1 ? "" : "s"}`} />
              </ChartCard>
            )}

            {show("eating") && eat.hasFeeds && (
              <ChartCard kicker="Feeds" icon={MODULE_ICONS.eating} inkClass="text-eating-ink" headline={eat.feedsHeadline} table={{ columns: ["Day", "Feeds", `Bottle (${householdSettings.volume_unit})`], rows: eat.feeds.map((f, i) => [shortDate(new Date(`${f.day}T00:00:00`)), f.value, eat.volume[i].value]) }} ariaRange={rangeText}>
                <DailyBars data={eat.feeds} color="var(--chart-5)" unit={(v) => `${v} feeds`} />
              </ChartCard>
            )}
            {show("eating") && eat.portions.length > 0 && (
              <ChartCard kicker="Meals" icon={MODULE_ICONS.eating} inkClass="text-eating-ink" headline={eat.portionsHeadline} caption="Average eaten by meal" table={eat.table} ariaRange={rangeText}>
                <LabeledBars data={eat.portions} highlight={[...eat.portions].sort((a, b) => (a.value ?? 0) - (b.value ?? 0))[0]?.label} domain={[0, 100]} format={(v) => `${v}%`} />
              </ChartCard>
            )}
            {show("eating") && eat.reactions.length > 0 && (
              <ChartCard kicker="Reactions" icon={MODULE_ICONS.eating} inkClass="text-eating-ink" headline={`${eat.reactions.reduce((s, r) => s + r.value, 0)} reaction${eat.reactions.reduce((s, r) => s + r.value, 0) === 1 ? "" : "s"} logged`} table={{ columns: ["Reaction", "Times"], rows: eat.reactions.map((r) => [r.label, r.value]) }} ariaRange={rangeText}>
                <TopBars data={eat.reactions} color="var(--chart-highlight)" />
              </ChartCard>
            )}

            {show("activity") && (
              <ChartCard kicker="Activity" icon={MODULE_ICONS.activity} inkClass="text-activity-ink" headline={act.headline} caption="Times logged" table={act.table} ariaRange={rangeText}>
                {act.top.length ? <TopBars data={act.top} color="var(--chart-4)" /> : <p className="text-body text-muted-foreground">Nothing to show yet.</p>}
              </ChartCard>
            )}
            {show("activity") && act.weekly.some((w) => w.value) && (
              <ChartCard kicker="Activity time" icon={MODULE_ICONS.activity} inkClass="text-activity-ink" headline={`About ${Math.round(act.weekly.reduce((s, w) => s + w.value, 0) / act.weekly.length)} minutes a week`} caption="Minutes per week, where a duration was logged" table={{ columns: ["Week of", "Minutes"], rows: act.weekly.map((w) => [w.label, w.value]) }} ariaRange={rangeText}>
                <LabeledBars data={act.weekly} />
              </ChartCard>
            )}

            {show("medication") && (
              <ChartCard kicker="Medication" icon={MODULE_ICONS.medication} inkClass="text-medication-ink" headline={meds.headline} caption="Given or partial ÷ scheduled (MED-10)" table={meds.adherenceTable} ariaRange={rangeText} footer={markerFooter}>
                {meds.adherence.length ? <LabeledBars data={meds.adherence} domain={[0, 100]} format={(v) => `${v}%`} /> : <p className="text-body text-muted-foreground">No scheduled medications.</p>}
              </ChartCard>
            )}
            {show("medication") && meds.points.length > 0 && (
              <ChartCard kicker="Dose times" icon={MODULE_ICONS.medication} inkClass="text-medication-ink" headline="When doses were given" table={{ columns: ["Day", "Time", "Medication"], rows: meds.points.map((p) => [shortDate(new Date(`${p.day}T00:00:00`)), `${Math.floor(p.hour)}:${String(Math.round((p.hour % 1) * 60)).padStart(2, "0")}`, p.name]) }} ariaRange={rangeText}>
                <DoseTimes points={meds.points} days={data.days} />
              </ChartCard>
            )}
            {show("medication") && (
              <ChartCard kicker="As needed" icon={MODULE_ICONS.medication} inkClass="text-medication-ink" headline={meds.prnHeadline} caption={meds.followups ? `Did it help: ${meds.followups}` : undefined} table={meds.prnTable} ariaRange={rangeText}>
                {meds.prnWeekly.length ? <LabeledBars data={meds.prnWeekly} /> : <p className="text-body text-muted-foreground">None logged.</p>}
              </ChartCard>
            )}
          </div>
        )}
      </div>
    </>
  );
}
