"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, Lightbulb, Plus, Check } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { InsightsNav } from "@/components/insights/InsightsNav";
import { LabeledBars } from "@/components/insights/charts";
import { MODULE_ICONS } from "@/components/log/LogSheet";
import { useHousehold } from "@/lib/context/household-provider";
import { useInsightsData } from "@/lib/insights/useInsightsData";
import { beforeAfterChange, hardestTimeOfDay, latestChange, moodAndBms, NOT_PROOF, PATTERN_RULES } from "@/lib/insights/patterns";
import { addReportItem, hasReportItem } from "@/lib/report-items";
import { addDays, shortDate, startOfDay } from "@/lib/dates";

function KeepLogging({ title, message, progress, goal }: { title: string; message: string; progress: number; goal: number }) {
  return (
    <section className="rounded-card bg-card shadow-card p-4 space-y-2.5" aria-label={`${title}: keep logging`}>
      <p className="text-label font-extrabold text-muted-foreground">{title}</p>
      <h2 className="font-display text-title-4">Keep logging</h2>
      <p className="text-body text-foreground-2">{message} · {progress} of {goal}</p>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={progress} aria-label={`${progress} of ${goal}`} className="h-2.5 rounded-full bg-secondary overflow-hidden">
        <div className="h-full rounded-full bg-profile" style={{ width: `${Math.min(100, (progress / goal) * 100)}%` }} />
      </div>
    </section>
  );
}

function PatternCard({
  id, kicker, headline, meta, how, children,
}: {
  id: string;
  kicker: string;
  headline: string;
  meta: string;
  how: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState(false);
  useEffect(() => setAdded(hasReportItem(id)), [id]);
  return (
    <section className="rounded-card bg-card shadow-card p-4 space-y-3" aria-label={`${kicker}: ${headline}`}>
      <p className="flex items-center gap-1.5 text-label font-extrabold text-mood-ink [&_svg]:w-4 [&_svg]:h-4">{MODULE_ICONS.mood}{kicker}</p>
      <h2 className="font-display text-title-4">{headline}</h2>
      <div role="img" aria-label={headline}>{children}</div>
      <p className="text-caption text-muted-foreground">
        {meta} ·{" "}
        <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-0.5 font-extrabold text-profile-ink underline-offset-2 underline">
          How we calculated this <ChevronDown size={14} strokeWidth={2} className={open ? "rotate-180" : ""} aria-hidden="true" />
        </button>
      </p>
      {open && <p className="text-caption text-foreground-2 bg-secondary rounded-lg p-3">{how}</p>}
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-divider">
        <p className="text-caption text-muted-foreground">{NOT_PROOF}</p>
        <button
          type="button"
          aria-pressed={added}
          onClick={() => {
            addReportItem({ id, title: headline, detail: meta });
            setAdded(true);
          }}
          className="flex-none min-h-touch-min px-3.5 flex items-center gap-1.5 rounded-full border-[1.5px] border-border-strong text-label font-extrabold"
        >
          {added ? <Check size={16} strokeWidth={2.5} aria-hidden="true" /> : <Plus size={16} strokeWidth={2} aria-hidden="true" />}
          {added ? "In report" : "Add to report"}
        </button>
      </div>
    </section>
  );
}

export default function PatternsPage() {
  const { activeProfile } = useHousehold();
  const now = useMemo(() => new Date(), []);
  const from = useMemo(() => startOfDay(addDays(now, -(PATTERN_RULES.WINDOW_DAYS - 1))), [now]);
  const data = useInsightsData(from, now);

  const pat01 = hardestTimeOfDay(data.inRange);
  const pat02 = moodAndBms(data.inRange, from, now);
  const change = latestChange(data.changes, now);
  const pat03 = change ? beforeAfterChange(data.all, change, now) : null;
  const changeLabel = change ? `${data.medName(change.medication_id)} ${change.change_type === "started" ? "started" : change.change_type === "dose_changed" ? "dose changed" : "schedule changed"}` : "";

  return (
    <>
      <AppHeader title="Insights">
        <InsightsNav />
      </AppHeader>
      <div className="px-5 pt-3 pb-6 space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
        {data.loading && <div className="h-64 rounded-card bg-muted animate-pulse" aria-busy="true" />}

        {!data.loading && pat03 && (pat03.status === "ready" ? (
          <PatternCard
            id={`pat03-${change!.medication_id}-${change!.effective_at}`}
            kicker={`Since ${changeLabel.toLowerCase()}, ${shortDate(new Date(`${change!.effective_at}T00:00:00`))}`}
            headline={`Mood averaged ${pat03.after.mood?.toFixed(1)}, ${pat03.after.mood! >= pat03.before.mood! ? "up" : "down"} from ${pat03.before.mood?.toFixed(1)} in the ${pat03.window} days before`}
            meta={`${pat03.window} days before and ${pat03.window} days after · BMs a day ${pat03.before.bmsPerDay} → ${pat03.after.bmsPerDay} · behaviors ${pat03.before.behaviors} → ${pat03.after.behaviors}`}
            how={`We averaged ${activeProfile?.name}'s daily mood for the ${pat03.window} days before the change and the ${pat03.window} days starting on it (${pat03.before.days} and ${pat03.after.days} days with mood logs), and counted BMs and notable behaviors in the same windows. Both sides need at least ${PATTERN_RULES.PAT03_MIN_DAYS_EACH} logged days.`}
          >
            <LabeledBars data={[{ label: "Before", value: pat03.before.mood }, { label: "After", value: pat03.after.mood }]} highlight="After" domain={[0, 5]} format={(v) => v.toFixed(1)} height={150} />
          </PatternCard>
        ) : (
          <KeepLogging title={`Since ${changeLabel.toLowerCase()}`} message={pat03.message} progress={pat03.progress} goal={pat03.goal} />
        ))}

        {!data.loading && (pat01.status === "ready" ? (
          <PatternCard
            id="pat01"
            kicker="Time of day"
            headline={`${pat01.hardest.label} is usually the hardest part of the day`}
            meta={`Last ${PATTERN_RULES.WINDOW_DAYS} days · ${pat01.logs} mood logs`}
            how={`We grouped ${pat01.logs} mood logs from ${pat01.days} days into 3-hour blocks, using the time where each was logged, and averaged each block. The lowest average is called out. This needs ${PATTERN_RULES.PAT01_MIN_DAYS} days and ${PATTERN_RULES.PAT01_MIN_LOGS} mood logs.`}
          >
            <LabeledBars data={pat01.blocks.filter((b) => b.key !== "night").map((b) => ({ label: b.label, value: b.avg }))} highlight={pat01.hardest.label} domain={[0, 5]} format={(v) => v.toFixed(1)} height={160} />
          </PatternCard>
        ) : (
          <KeepLogging title="Time of day" message={pat01.message} progress={pat01.progress} goal={pat01.goal} />
        ))}

        {!data.loading && enabledBm(activeProfile?.enabledModules) && (pat02.status === "ready" ? (
          <PatternCard
            id="pat02"
            kicker="Mood and BMs"
            headline={`On days with no BM, mood averaged ${pat02.without.toFixed(1)}, compared with ${pat02.with.toFixed(1)} on days with one`}
            meta={`${pat02.daysWithout} days without a BM, ${pat02.daysWith} days with`}
            how={`For the last ${PATTERN_RULES.WINDOW_DAYS} days we split days by whether a BM was logged and compared the average daily mood. It's shown when the gap is at least ${PATTERN_RULES.PAT02_MIN_GAP} points and each group has ${PATTERN_RULES.PAT02_MIN_DAYS_EACH} or more days.`}
          >
            <LabeledBars data={[{ label: "No BM", value: pat02.without }, { label: "With a BM", value: pat02.with }]} highlight="No BM" domain={[0, 5]} format={(v) => v.toFixed(1)} height={150} />
          </PatternCard>
        ) : pat02.status === "keep_logging" ? (
          <KeepLogging title="Mood and BMs" message={pat02.message} progress={pat02.progress} goal={pat02.goal} />
        ) : (
          <section className="rounded-card bg-card shadow-card p-4 space-y-1.5">
            <p className="text-label font-extrabold text-muted-foreground">Mood and BMs</p>
            <p className="text-body text-foreground-2">No clear difference in mood between days with and without a BM ({pat02.with.toFixed(1)} and {pat02.without.toFixed(1)}).</p>
          </section>
        ))}

        {!data.loading && (
          <p className="flex items-start gap-2 px-1 text-caption text-muted-foreground lg:col-span-2">
            <Lightbulb size={16} strokeWidth={2} className="flex-none mt-0.5" aria-hidden="true" />
            Patterns describe what was logged. They aren&rsquo;t a diagnosis or advice.
          </p>
        )}
      </div>
    </>
  );
}

function enabledBm(mods: string[] | undefined) {
  return !mods || (mods.includes("bathroom") && mods.includes("mood"));
}
