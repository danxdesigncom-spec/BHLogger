"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, Lightbulb, Plus, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { AppHeader } from "@/components/layout/AppHeader";
import { InsightsNav } from "@/components/insights/InsightsNav";
import { LabeledBars } from "@/components/insights/charts";
import { MODULE_ICONS } from "@/components/log/LogSheet";
import { useHousehold } from "@/lib/context/household-provider";
import { useInsightsData } from "@/lib/insights/useInsightsData";
import { beforeAfterChange, hardestTimeOfDay, latestChange, moodAndBms, notProof, PATTERN_RULES } from "@/lib/insights/patterns";
import { addReportItem, hasReportItem } from "@/lib/report-items";
import { addDays, shortDate, startOfDay } from "@/lib/dates";

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
  const t = useTranslations("insights.patterns");
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
          {t("howCalculated")} <ChevronDown size={14} strokeWidth={2} className={open ? "rotate-180" : ""} aria-hidden="true" />
        </button>
      </p>
      {open && <p className="text-caption text-foreground-2 bg-secondary rounded-lg p-3">{how}</p>}
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-divider">
        <p className="text-caption text-muted-foreground">{notProof()}</p>
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
          {added ? t("inReport") : t("addToReport")}
        </button>
      </div>
    </section>
  );
}

export default function PatternsPage() {
  const { activeProfile } = useHousehold();
  const tr = useTranslations();
  const t = useTranslations("insights.patterns");
  const now = useMemo(() => new Date(), []);
  const from = useMemo(() => startOfDay(addDays(now, -(PATTERN_RULES.WINDOW_DAYS - 1))), [now]);
  const data = useInsightsData(from, now);

  const pat01 = hardestTimeOfDay(data.inRange);
  const pat02 = moodAndBms(data.inRange, from, now);
  const change = latestChange(data.changes, now);
  const pat03 = change ? beforeAfterChange(data.all, change, now) : null;
  const changeLabel = change
    ? t(change.change_type === "started" ? "changeStarted" : change.change_type === "dose_changed" ? "changeDose" : "changeSchedule", { name: data.medName(change.medication_id) })
    : "";
  const R = PATTERN_RULES;

  return (
    <>
      <AppHeader title={tr("insights.title")}>
        <InsightsNav />
      </AppHeader>
      <div className="px-5 pt-3 pb-6 space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
        {data.loading && <div className="h-64 rounded-card bg-muted animate-pulse" aria-busy="true" />}

        {!data.loading && pat03 && (pat03.status === "ready" ? (
          <PatternCard
            id={`pat03-${change!.medication_id}-${change!.effective_at}`}
            kicker={t("since", { change: changeLabel.toLowerCase(), date: shortDate(new Date(`${change!.effective_at}T00:00:00`)) })}
            headline={t("pat03Headline", { after: pat03.after.mood?.toFixed(1) ?? "", direction: pat03.after.mood! >= pat03.before.mood! ? t("up") : t("down"), before: pat03.before.mood?.toFixed(1) ?? "", days: pat03.window })}
            meta={t("pat03Meta", { days: pat03.window, bmBefore: pat03.before.bmsPerDay ?? 0, bmAfter: pat03.after.bmsPerDay ?? 0, behBefore: pat03.before.behaviors, behAfter: pat03.after.behaviors })}
            how={t("pat03How", { name: activeProfile?.name ?? "", days: pat03.window, beforeDays: pat03.before.days, afterDays: pat03.after.days, min: R.PAT03_MIN_DAYS_EACH })}
          >
            <LabeledBars data={[{ label: t("before"), value: pat03.before.mood }, { label: t("after"), value: pat03.after.mood }]} highlight={t("after")} domain={[0, 5]} format={(v) => v.toFixed(1)} height={150} />
          </PatternCard>
        ) : (
          <KeepLogging title={t("sinceShort", { change: changeLabel.toLowerCase() })} message={pat03.message} progress={pat03.progress} goal={pat03.goal} />
        ))}

        {!data.loading && (pat01.status === "ready" ? (
          <PatternCard
            id="pat01"
            kicker={t("timeOfDay")}
            headline={t("pat01Headline", { block: pat01.hardest.label })}
            meta={t("pat01Meta", { days: R.WINDOW_DAYS, count: pat01.logs })}
            how={t("pat01How", { count: pat01.logs, days: pat01.days, minDays: R.PAT01_MIN_DAYS, minLogs: R.PAT01_MIN_LOGS })}
          >
            <LabeledBars data={pat01.blocks.filter((b) => b.key !== "night").map((b) => ({ label: b.label, value: b.avg }))} highlight={pat01.hardest.label} domain={[0, 5]} format={(v) => v.toFixed(1)} height={160} />
          </PatternCard>
        ) : (
          <KeepLogging title={t("timeOfDay")} message={pat01.message} progress={pat01.progress} goal={pat01.goal} />
        ))}

        {!data.loading && enabledBm(activeProfile?.enabledModules) && (pat02.status === "ready" ? (
          <PatternCard
            id="pat02"
            kicker={t("moodAndBms")}
            headline={t("pat02Headline", { without: pat02.without.toFixed(1), with: pat02.with.toFixed(1) })}
            meta={t("pat02Meta", { without: pat02.daysWithout, with: pat02.daysWith })}
            how={t("pat02How", { days: R.WINDOW_DAYS, gap: R.PAT02_MIN_GAP, min: R.PAT02_MIN_DAYS_EACH })}
          >
            <LabeledBars data={[{ label: t("noBm"), value: pat02.without }, { label: t("withBm"), value: pat02.with }]} highlight={t("noBm")} domain={[0, 5]} format={(v) => v.toFixed(1)} height={150} />
          </PatternCard>
        ) : pat02.status === "keep_logging" ? (
          <KeepLogging title={t("moodAndBms")} message={pat02.message} progress={pat02.progress} goal={pat02.goal} />
        ) : (
          <section className="rounded-card bg-card shadow-card p-4 space-y-1.5">
            <p className="text-label font-extrabold text-muted-foreground">{t("moodAndBms")}</p>
            <p className="text-body text-foreground-2">{t("noDifference", { with: pat02.with.toFixed(1), without: pat02.without.toFixed(1) })}</p>
          </section>
        ))}

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

function enabledBm(mods: string[] | undefined) {
  return !mods || (mods.includes("bathroom") && mods.includes("mood"));
}
