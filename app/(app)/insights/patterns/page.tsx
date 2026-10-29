"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, Lightbulb } from "lucide-react";
import { useTranslations } from "next-intl";
import { AppHeader } from "@/components/layout/AppHeader";
import { AddToReportButton } from "@/components/insights/AddToReportButton";
import { InsightsNav } from "@/components/insights/InsightsNav";
import { LabeledBars } from "@/components/insights/charts";
import { MODULE_ICONS, type ModuleType } from "@/components/log/LogSheet";
import { useHousehold } from "@/lib/context/household-provider";
import { useOptions } from "@/lib/data/hooks";
import { useInsightsData } from "@/lib/insights/useInsightsData";
import {
  activitiesThatLift, beforeAfterChange, eatingAndMood, hardestTimeOfDay, latestChange, moodAndBms, notProof, PATTERN_RULES,
  prnTiming, weekdayMood,
} from "@/lib/insights/patterns";
import { activityLabel, labelFor, PRN_REASONS } from "@/lib/options";
import { patternIds } from "@/lib/reports/patterns";
import { patternItemId } from "@/lib/report-items";
import { addDays, shortDate, startOfDay, weekdayName } from "@/lib/dates";
import { weekStartIndex } from "@/lib/prefs";

const INK: Record<ModuleType, string> = {
  bathroom: "text-bathroom-ink", eating: "text-eating-ink", activity: "text-activity-ink", mood: "text-mood-ink", medication: "text-medication-ink",
};

function Kicker({ module, children }: { module: ModuleType; children: ReactNode }) {
  return <p className={`flex items-center gap-1.5 text-label font-extrabold ${INK[module]} [&_svg]:w-4 [&_svg]:h-4`}>{MODULE_ICONS[module]}{children}</p>;
}

function KeepLogging({ title, message, progress, goal }: { title: string; message: string; progress: number; goal: number }) {
  const t = useTranslations("insights.patterns");
  return (
    <section className="rounded-card bg-card shadow-card p-4 space-y-2.5" aria-label={t("keepLoggingLabel", { title })}>
      <p className="text-label font-extrabold text-muted-foreground">{title}</p>
      <h2 className="font-display text-title-4">{t("keepLogging")}</h2>
      <p className="text-body text-foreground-2">{t("progress", { message, progress, goal })}</p>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={progress} aria-label={t("progressOf", { progress, goal })} className="h-2.5 rounded-full bg-secondary overflow-hidden">
        <div className="h-full rounded-full bg-profile" style={{ width: `${Math.min(100, (progress / goal) * 100)}%` }} />
      </div>
    </section>
  );
}

/** A rule that had enough data but found no clear difference: the statement and its sample size. */
function NoPattern({ title, text, meta }: { title: string; text: string; meta: string }) {
  return (
    <section className="rounded-card bg-card shadow-card p-4 space-y-1.5" aria-label={title}>
      <p className="text-label font-extrabold text-muted-foreground">{title}</p>
      <p className="text-body text-foreground-2">{text}</p>
      <p className="text-caption text-muted-foreground">{meta}</p>
    </section>
  );
}

function PatternCard({
  id, module = "mood", kicker, headline, meta, how, children,
}: {
  id: string;
  module?: ModuleType;
  kicker: string;
  headline: string;
  meta: string;
  how: string;
  children: ReactNode;
}) {
  const t = useTranslations("insights.patterns");
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-card bg-card shadow-card p-4 space-y-3" aria-label={`${kicker}: ${headline}`}>
      <Kicker module={module}>{kicker}</Kicker>
      <h2 className="font-display text-title-4">{headline}</h2>
      <div role="img" aria-label={headline}>{children}</div>
      <p className="text-caption text-muted-foreground">
        {meta} ·{" "}
        <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-0.5 font-extrabold text-profile-ink underline-offset-2 underline">
          {t("howCalculated")} <ChevronDown size={14} strokeWidth={2} className={open ? "rotate-180" : ""} aria-hidden="true" />
        </button>
      </p>
      {open && <p className="text-caption text-foreground-2 bg-secondary rounded-lg p-3">{how}</p>}
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-divider">
        <p className="text-caption text-muted-foreground">{notProof()}</p>
        <AddToReportButton id={patternItemId(id)} kind="pattern" title={kicker} detail={headline} />
      </div>
    </section>
  );
}

type Slot = { key: string; rank: 0 | 1 | 2; node: ReactNode };

export default function PatternsPage() {
  const { activeProfile } = useHousehold();
  const tr = useTranslations();
  const t = useTranslations("insights.patterns");
  const now = useMemo(() => new Date(), []);
  const from = useMemo(() => startOfDay(addDays(now, -(PATTERN_RULES.WINDOW_DAYS - 1))), [now]);
  const data = useInsightsData(from, now);
  const customActivities = useOptions(activeProfile?.id ?? null, "activity");
  const R = PATTERN_RULES;
  const name = activeProfile?.name ?? "";
  const mods = new Set(activeProfile?.enabledModules ?? []);
  const has = (...m: string[]) => !activeProfile || m.every((x) => mods.has(x));
  const fmt = (v: number) => v.toFixed(1);
  const lastDays = t("lastDays", { days: R.WINDOW_DAYS });

  const slots: Slot[] = [];
  const keep = (key: string, title: string, p: { message: string; progress: number; goal: number }) =>
    slots.push({ key, rank: 2, node: <KeepLogging title={title} message={p.message} progress={p.progress} goal={p.goal} /> });

  if (!data.loading) {
    // PAT-03
    const change = latestChange(data.changes, now);
    const pat03 = change ? beforeAfterChange(data.all, change, now) : null;
    if (change && pat03) {
      const changeLabel = t(change.change_type === "started" ? "changeStarted" : change.change_type === "dose_changed" ? "changeDose" : "changeSchedule", { name: data.medName(change.medication_id) });
      if (pat03.status === "ready") {
        slots.push({
          key: "pat03", rank: 0, node: (
            <PatternCard
              id={patternIds.pat03(change)}
              kicker={t("since", { change: changeLabel.toLowerCase(), date: shortDate(new Date(`${change.effective_at}T00:00:00`)) })}
              headline={t("pat03Headline", { after: pat03.after.mood?.toFixed(1) ?? "", direction: pat03.after.mood! >= pat03.before.mood! ? t("up") : t("down"), before: pat03.before.mood?.toFixed(1) ?? "", days: pat03.window })}
              meta={t("pat03Meta", { days: pat03.window, bmBefore: pat03.before.bmsPerDay ?? 0, bmAfter: pat03.after.bmsPerDay ?? 0, behBefore: pat03.before.behaviors, behAfter: pat03.after.behaviors })}
              how={t("pat03How", { name, days: pat03.window, beforeDays: pat03.before.days, afterDays: pat03.after.days, min: R.PAT03_MIN_DAYS_EACH })}
            >
              <LabeledBars data={[{ label: t("before"), value: pat03.before.mood }, { label: t("after"), value: pat03.after.mood }]} highlight={t("after")} domain={[0, 5]} format={fmt} height={150} />
            </PatternCard>
          ),
        });
      } else keep("pat03", t("sinceShort", { change: changeLabel.toLowerCase() }), pat03);
    }

    // PAT-01
    const pat01 = hardestTimeOfDay(data.inRange);
    if (pat01.status === "ready") {
      slots.push({
        key: "pat01", rank: 0, node: (
          <PatternCard
            id="pat01"
            kicker={t("timeOfDay")}
            headline={t("pat01Headline", { block: pat01.hardest.label })}
            meta={t("pat01Meta", { days: R.WINDOW_DAYS, count: pat01.logs })}
            how={t("pat01How", { count: pat01.logs, days: pat01.days, minDays: R.PAT01_MIN_DAYS, minLogs: R.PAT01_MIN_LOGS })}
          >
            <LabeledBars data={pat01.blocks.filter((b) => b.key !== "night").map((b) => ({ label: b.label, value: b.avg }))} highlight={pat01.hardest.label} domain={[0, 5]} format={fmt} height={160} />
          </PatternCard>
        ),
      });
    } else keep("pat01", t("timeOfDay"), pat01);

    // PAT-02
    if (has("bathroom", "mood")) {
      const pat02 = moodAndBms(data.inRange, from, now);
      if (pat02.status === "ready") {
        slots.push({
          key: "pat02", rank: 0, node: (
            <PatternCard
              id="pat02"
              kicker={t("moodAndBms")}
              headline={t("pat02Headline", { without: fmt(pat02.without), with: fmt(pat02.with) })}
              meta={t("pat02Meta", { without: pat02.daysWithout, with: pat02.daysWith })}
              how={t("pat02How", { days: R.WINDOW_DAYS, gap: R.PAT02_MIN_GAP, min: R.PAT02_MIN_DAYS_EACH })}
            >
              <LabeledBars data={[{ label: t("noBm"), value: pat02.without }, { label: t("withBm"), value: pat02.with }]} highlight={t("noBm")} domain={[0, 5]} format={fmt} height={150} />
            </PatternCard>
          ),
        });
      } else if (pat02.status === "keep_logging") keep("pat02", t("moodAndBms"), pat02);
      else slots.push({ key: "pat02", rank: 1, node: <NoPattern title={t("moodAndBms")} text={t("noDifference", { with: fmt(pat02.with), without: fmt(pat02.without) })} meta={t("pat02Meta", { without: pat02.daysWithout, with: pat02.daysWith })} /> });
    }

    // PAT-04
    if (has("activity", "mood")) {
      const activityName = (key: string) => activityLabel(key, (customActivities.data ?? []).map((o) => ({ key: o.key, label: o.label })));
      const pat04 = activitiesThatLift(data.inRange);
      if (pat04.status === "ready") {
        const top = pat04.lifts[0];
        slots.push({
          key: "pat04", rank: 0, node: (
            <PatternCard
              id="pat04"
              module="activity"
              kicker={t("activities")}
              headline={t("pat04Headline", { activity: activityName(top.key).toLowerCase(), avg: fmt(top.avg), overall: fmt(pat04.overall) })}
              meta={t("pat04Meta", { last: lastDays, times: top.times, logs: pat04.moodLogs })}
              how={t("pat04How", { hours: R.PAT04_AFTER_HOURS, min: R.PAT04_MIN_TIMES, lift: R.PAT04_MIN_LIFT, checked: pat04.checked })}
            >
              <LabeledBars
                data={[...pat04.lifts.map((l) => ({ label: activityName(l.key), value: l.avg })), { label: t("overall"), value: pat04.overall }]}
                highlight={activityName(top.key)}
                domain={[0, 5]}
                format={fmt}
                height={150}
              />
            </PatternCard>
          ),
        });
      } else if (pat04.status === "keep_logging") keep("pat04", t("activities"), pat04);
      else slots.push({ key: "pat04", rank: 1, node: <NoPattern title={t("activities")} text={t("pat04None", { overall: fmt(pat04.overall), lift: R.PAT04_MIN_LIFT })} meta={t("pat04NoneMeta", { last: lastDays, checked: pat04.checked })} /> });
    }

    // PAT-05
    const pat05 = weekdayMood(data.inRange, from, now);
    if (pat05.status === "keep_logging") keep("pat05", t("weekday"), pat05);
    else {
      const meta = t("pat05Meta", { last: lastDays, days: pat05.days });
      if (pat05.status === "ready") {
        const order = [0, 1, 2, 3, 4, 5, 6].map((i) => (i + weekStartIndex()) % 7);
        slots.push({
          key: "pat05", rank: 0, node: (
            <PatternCard
              id="pat05"
              kicker={t("weekday")}
              headline={t("pat05Headline", { hardest: weekdayName(pat05.hardest.weekday), hardestAvg: fmt(pat05.hardest.avg), best: weekdayName(pat05.best.weekday), bestAvg: fmt(pat05.best.avg) })}
              meta={meta}
              how={t("pat05How", { weeks: R.PAT05_MIN_WEEKS, gap: R.PAT05_MIN_GAP })}
            >
              <LabeledBars data={order.map((w) => ({ label: weekdayName(w, "short"), value: pat05.weekdays[w].avg }))} highlight={weekdayName(pat05.hardest.weekday, "short")} domain={[0, 5]} format={fmt} height={150} />
            </PatternCard>
          ),
        });
      } else {
        slots.push({ key: "pat05", rank: 1, node: <NoPattern title={t("weekday")} text={t("pat05None", { low: fmt(pat05.hardest.avg), high: fmt(pat05.best.avg) })} meta={meta} /> });
      }
    }

    // PAT-06
    const eatsMeals = !activeProfile || activeProfile.feedingMethods.some((m) => m === "meal" || m === "snack");
    if (has("eating", "mood") && eatsMeals) {
      const pat06 = eatingAndMood(data.inRange, from, now);
      if (pat06.status === "keep_logging") keep("pat06", t("eatingAndMood"), pat06);
      else {
        const meta = t("pat06Meta", { low: pat06.lowDays, other: pat06.otherDays });
        if (pat06.status === "ready") {
          slots.push({
            key: "pat06", rank: 0, node: (
              <PatternCard
                id="pat06"
                module="eating"
                kicker={t("eatingAndMood")}
                headline={t("pat06Headline", { name, low: pat06.low, other: pat06.other })}
                meta={meta}
                how={t("pat06How", { days: R.WINDOW_DAYS, mood: R.PAT06_LOW_MOOD, min: R.PAT06_MIN_DAYS_EACH, gap: R.PAT06_MIN_GAP })}
              >
                <LabeledBars data={[{ label: t("lowMoodDays"), value: pat06.low }, { label: t("otherDays"), value: pat06.other }]} highlight={t("lowMoodDays")} domain={[0, 100]} format={(v) => `${v}%`} height={150} />
              </PatternCard>
            ),
          });
        } else {
          slots.push({ key: "pat06", rank: 1, node: <NoPattern title={t("eatingAndMood")} text={t("pat06None", { low: pat06.low, other: pat06.other })} meta={meta} /> });
        }
      }
    }

    // PAT-07
    if (has("medication")) {
      const prn = data.meds.filter((m) => m.kind === "prn").map((m) => ({ id: m.id, name: m.name }));
      for (const p of prnTiming(data.inRange, prn)) {
        const title = t("prnTiming", { name: p.med.name });
        if (p.status === "keep_logging") {
          keep(`pat07-${p.med.id}`, title, p);
          continue;
        }
        const reason = p.reason ? labelFor(PRN_REASONS, p.reason.key).toLowerCase() : null;
        slots.push({
          key: `pat07-${p.med.id}`, rank: 0, node: (
            <PatternCard
              id={patternIds.pat07(p.med.id)}
              module="medication"
              kicker={title}
              headline={reason ? t("pat07HeadlineReason", { block: p.top.label, reason }) : t("pat07Headline", { block: p.top.label })}
              meta={t("pat07Meta", { last: lastDays, doses: p.doses, count: p.top.count, reasonCount: p.reason?.count ?? 0 })}
              how={t("pat07How", { min: R.PAT07_MIN_DOSES })}
            >
              <LabeledBars data={p.blocks.filter((b) => b.count > 0 || b.key !== "night").map((b) => ({ label: b.label, value: b.count }))} highlight={p.top.label} height={150} />
            </PatternCard>
          ),
        });
      }
    }
  }

  // Patterns found first, then rules with no clear difference, then the ones still collecting data.
  const ordered = slots.map((s, i) => ({ ...s, i })).sort((a, b) => a.rank - b.rank || a.i - b.i);

  return (
    <>
      <AppHeader title={tr("insights.title")}>
        <InsightsNav />
      </AppHeader>
      <div className="px-5 pt-3 pb-6 space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
        {data.loading && <div className="h-64 rounded-card bg-muted animate-pulse" aria-busy="true" />}
        {ordered.map((s) => <Fragment key={s.key}>{s.node}</Fragment>)}
        {!data.loading && (
          <p className="flex items-start gap-2 px-1 text-caption text-muted-foreground lg:col-span-2">
            <Lightbulb size={16} strokeWidth={2} className="flex-none mt-0.5" aria-hidden="true" />
            {t("footer")}
          </p>
        )}
      </div>
    </>
  );
}
