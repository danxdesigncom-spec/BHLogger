"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { DailyBars, MoodLine } from "@/components/insights/charts";
import { useHousehold } from "@/lib/context/household-provider";
import { useEntries, useMedicationChanges, useMedications, useProfileSettings } from "@/lib/data/hooks";
import { entryDetail, entryTitle, type SummaryContext } from "@/lib/entries/summary";
import { activityStats, blockOf, behaviorEvents, dataOf, eachDay, localParts, tally } from "@/lib/insights/core";
import { bathroomTrend, behaviorTrend, moodTrend } from "@/lib/insights/trends";
import { beforeAfterChange, hardestTimeOfDay, latestChange, moodAndBms, notProof } from "@/lib/insights/patterns";
import { adherence, describeSchedule } from "@/lib/meds/schedule";
import { activityLabel, ageLabel, behaviorLabel, formatDose, humanize, labelFor, medFormLabel, moodLabels, PRN_REASONS, SEVERITIES } from "@/lib/options";
import { flaggedEvents } from "@/lib/reports/flagged";
import { savedQuestions, TEMPLATES, type SectionKey, type TemplateKey } from "@/lib/reports/templates";
import { reportItems, type ReportItem } from "@/lib/report-items";
import { fromYmd, longDate, shortDate } from "@/lib/dates";
import type { MedicationChangeRow } from "@/lib/data/types";

type Translate = (key: string, values?: Record<string, string | number>) => string;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="report-section space-y-2">
      <h2 className="text-[18px] leading-tight font-extrabold font-sans">{title}</h2>
      {children}
    </section>
  );
}

function Table({ columns, rows }: { columns: string[]; rows: ReactNode[][] }) {
  return (
    <table className="w-full text-[14px] leading-[1.45] tabular-nums border-collapse">
      <thead>
        <tr className="border-b-2 border-foreground">
          {columns.map((c) => <th key={c} scope="col" className="text-left font-extrabold py-1.5 pr-3 align-bottom">{c}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-border">
            {r.map((v, j) => <td key={j} className="py-1.5 pr-3 align-top">{v}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function describeChange(c: MedicationChangeRow, name: string, t: Translate) {
  const b = c.before as { default_dose?: number; dose_unit?: string };
  const a = c.after as { default_dose?: number; dose_unit?: string };
  const date = longDate(fromYmd(c.effective_at));
  if (c.change_type === "dose_changed") return t("changeDose", { name, from: formatDose(b.default_dose ?? 0, b.dose_unit ?? ""), to: formatDose(a.default_dose ?? 0, a.dose_unit ?? ""), date });
  if (c.change_type === "started") return t("changeStarted", { name, date });
  if (c.change_type === "stopped") return t("changeStopped", { name, date });
  return t("changeSchedule", { name, date });
}

const MARKER_KEY: Record<string, string> = { dose_changed: "markerDose", started: "markerStarted", stopped: "markerStopped", schedule_changed: "markerSchedule" };

export function ReportDocument() {
  const params = useSearchParams();
  const t = useTranslations("reports.doc");
  const tr = useTranslations();
  const tc = useTranslations("common");
  const ta = useTranslations("app");
  const { profiles, currentMember, householdSettings } = useHousehold();
  const profile = profiles.find((p) => p.id === params.get("p")) ?? profiles[0];
  const template = (params.get("t") ?? "doctor") as TemplateKey;
  const sections = new Set((params.get("s") ?? TEMPLATES[template]?.sections.join(",") ?? "").split(",") as SectionKey[]);
  const fromStr = params.get("from") ?? "";
  const toStr = params.get("to") ?? "";
  const from = useMemo(() => fromYmd(fromStr), [fromStr]);
  const to = useMemo(() => new Date(`${toStr}T23:59:59.999`), [toStr]);
  const settings = useProfileSettings(profile?.id ?? null);

  const entries = useEntries({ profileId: profile?.id, from: new Date(from.getTime() - 15 * 86_400_000).toISOString(), to: to.toISOString() }, !!profile);
  const meds = useMedications(profile?.id ?? null);
  const changes = useMedicationChanges(profile?.id ?? null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [items, setItems] = useState<ReportItem[]>([]);
  useEffect(() => {
    if (profile) setQuestions(savedQuestions(profile.id));
    setItems(reportItems());
  }, [profile]);

  if (!profile) return null;
  const loading = entries.isLoading || meds.isLoading;
  const stage = profile.careStage;
  const days = eachDay(from, to);
  const all = entries.data ?? [];
  const inRange = all.filter((e) => e.occurred_at >= from.toISOString() && e.occurred_at <= to.toISOString());
  const medName = (id: string) => meds.data?.find((m) => m.id === id)?.name ?? t("medication");
  const ctx: SummaryContext = { careStage: stage, toileting: profile.toileting, volumeUnit: householdSettings.volume_unit, medicationName: medName };
  const changesInRange = (changes.data ?? []).filter((c) => c.effective_at >= fromStr && c.effective_at <= toStr);
  const markers = changesInRange.map((c) => ({
    day: c.effective_at,
    label: t(MARKER_KEY[c.change_type] ?? "markerSchedule", { name: medName(c.medication_id) }),
  }));

  const mood = moodTrend(inRange, [], days, markers, stage);
  const bath = bathroomTrend(inRange, [], days, from, to, stage, profile.toileting, settings.bm_alert_days);
  const beh = behaviorTrend(inRange, [], days, markers);
  const events = behaviorEvents(inRange);
  const meals = inRange.filter((e) => e.type === "eating" && ["meal", "snack"].includes(String(dataOf(e).method)) && dataOf(e).portion_pct !== undefined);
  const halfOrMore = meals.filter((e) => Number(dataOf(e).portion_pct) >= 50).length;
  const feeds = inRange.filter((e) => e.type === "eating" && ["breast", "bottle"].includes(String(dataOf(e).method)));
  const tubeFeeds = inRange.filter((e) => e.type === "eating" && dataOf(e).method === "tube");
  const tubeMl = tubeFeeds.reduce((s, e) => s + (Number(dataOf(e).amount_ml) || 0), 0);
  const card = profile.careCard as { allergies?: string[]; conditions?: string[]; communication_notes?: string; calming_strategies?: string[]; doctor?: { name?: string } };
  const flagged = flaggedEvents(inRange, { from, to, bmAlertDays: settings.bm_alert_days, medName, describe: (e) => `${entryTitle(e, ctx)}${entryDetail(e) ? `, ${entryDetail(e).toLowerCase()}` : ""}` });

  const pat01 = hardestTimeOfDay(inRange.filter((e) => new Date(e.occurred_at) >= new Date(to.getTime() - 30 * 86_400_000)));
  const pat02 = moodAndBms(inRange, from, to);
  const change = latestChange((changes.data ?? []).filter((c) => c.change_type !== "started" || c.effective_at >= fromStr), to);
  const pat03 = change ? beforeAfterChange(all, change, to) : null;
  const patternLines: string[] = [];
  if (pat03?.status === "ready") patternLines.push(t("patChange", { after: pat03.after.mood?.toFixed(1) ?? "", name: medName(change!.medication_id).toLowerCase(), date: shortDate(fromYmd(change!.effective_at)), before: pat03.before.mood?.toFixed(1) ?? "", days: pat03.window }));
  if (pat01.status === "ready") {
    const others = pat01.blocks.filter((b) => b.key !== pat01.hardest.key && b.avg !== null);
    const avgOthers = others.reduce((s, b) => s + (b.avg ?? 0), 0) / Math.max(1, others.length);
    patternLines.push(t("patTime", { block: pat01.hardest.label, avg: pat01.hardest.avg?.toFixed(1) ?? "", others: avgOthers.toFixed(1) }));
  }
  if (pat02.status === "ready") patternLines.push(t("patBm", { without: pat02.without.toFixed(1), with: pat02.with.toFixed(1) }));
  for (const i of items) if (!patternLines.some((l) => l.startsWith(i.title.slice(0, 20)))) patternLines.push(t("item", { title: i.title }));

  const behaviorRows = tally(events.map((b) => b.key)).map((row) => {
    const mine = events.filter((b) => b.key === row.key);
    const sev = tally(mine.map((b) => b.severity ?? "")).filter((s) => s.key)[0]?.key;
    const block = tally(mine.map((b) => blockOf(localParts(b.entry).hour).label))[0]?.key;
    return [behaviorLabel(row.key), sev ? labelFor(SEVERITIES, sev) : "—", block ?? "—", row.count];
  });
  const [lowMood, , , , highMood] = moodLabels(stage);

  const title = TEMPLATES[template]?.title ?? t("fallbackTitle");
  const show = (s: SectionKey) => sections.has(s);
  const age = ageLabel(profile.dob);

  return (
    <div className="report-wrap">
      <div className="print:hidden flex items-center justify-between gap-3 px-5 pt-[18px] pb-3">
        <Link href="/reports" aria-label={t("back")} className="w-11 h-11 rounded-full bg-card shadow-raised flex items-center justify-center">
          <ChevronLeft size={22} strokeWidth={2} aria-hidden="true" />
        </Link>
        <button type="button" onClick={() => window.print()} className="h-button px-5 flex items-center gap-2 rounded-full bg-primary text-primary-foreground text-body-md">
          <Printer size={18} strokeWidth={2} aria-hidden="true" /> {t("print")}
        </button>
      </div>

      <article data-theme="light" className="report-doc mx-auto bg-card text-foreground font-sans" aria-label={t("docLabel", { title, name: profile.name })}>
        <header className="flex items-center justify-between gap-4 pb-3 border-b-4 border-profile" data-profile-color={profile.color}>
          <span className="flex items-center gap-2 text-[13px] font-extrabold">
            <span aria-hidden="true" className="w-6 h-6 rounded-md bg-profile" /> {ta("name")}
          </span>
          <span className="text-[13px] font-bold text-foreground-2">{title}</span>
        </header>

        <section className="report-section pt-4 space-y-1">
          <h1 className="text-[30px] leading-tight font-extrabold font-sans">{profile.name}</h1>
          <p className="text-[14px]">
            {[age ? t("age", { age }) : null, profile.dob ? t("born", { date: longDate(fromYmd(profile.dob)) }) : null, t("period", { from: shortDate(from), to: longDate(to), days: days.length })].filter(Boolean).join(" · ")}
          </p>
          <p className="text-[14px] text-foreground-2">
            {card.doctor?.name
              ? t("preparedByFor", { name: currentMember.displayName, date: longDate(new Date()), doctor: card.doctor.name })
              : t("preparedBy", { name: currentMember.displayName, date: longDate(new Date()) })}
          </p>
        </section>

        {loading ? (
          <p className="text-[14px] text-foreground-2">{tc("loading")}</p>
        ) : (
          <>
            {show("carecard") && (
              <section className="report-section grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <h2 className="text-[18px] font-extrabold font-sans">{t("allergies")}</h2>
                  <p className="text-[14px]">{card.allergies?.length ? card.allergies.join(", ") : t("noneRecorded")}</p>
                  {!!card.conditions?.length && <p className="text-[14px] text-foreground-2">{t("conditions", { list: card.conditions.join(", ") })}</p>}
                </div>
                <div className="space-y-1">
                  <h2 className="text-[18px] font-extrabold font-sans">{t("careNotes")}</h2>
                  <p className="text-[14px]">{[card.communication_notes, card.calming_strategies?.length ? t("calmsWith", { list: card.calming_strategies.join(", ").toLowerCase() }) : null].filter(Boolean).join(" ") || t("noneRecorded")}</p>
                </div>
              </section>
            )}

            {show("meds") && (
              <Section title={t("currentMeds")}>
                <Table
                  columns={[t("colMedication"), t("colDose"), t("colSchedule"), t("colStarted"), t("colGiven")]}
                  rows={(meds.data ?? []).filter((m) => m.active).map((m) => {
                    let given: string;
                    if (m.kind === "scheduled") {
                      const a = adherence(m, inRange as never, from, to, new Date());
                      given = a.scheduled ? t("givenOf", { given: a.given + a.partial, total: a.scheduled, pct: a.pct ?? 0 }) : "—";
                    } else {
                      const prn = inRange.filter((e) => e.type === "medication" && dataOf(e).medication_id === m.id);
                      const reason = tally(prn.map((e) => String(dataOf(e).prn_reason ?? ""))).filter((r) => r.key)[0];
                      given = prn.length ? (reason ? t("prnDosesFor", { count: prn.length, reason: labelFor(PRN_REASONS, reason.key).toLowerCase() }) : t("prnDoses", { count: prn.length })) : t("none");
                    }
                    return [m.form ? t("medWithForm", { name: m.name, form: medFormLabel(m.form).toLowerCase() }) : m.name, formatDose(Number(m.default_dose), m.dose_unit), m.kind === "prn" ? t("asNeeded") : humanize(describeSchedule(m)), m.start_date ? longDate(fromYmd(m.start_date)) : "—", given];
                  })}
                />
                {changesInRange.length > 0 && (
                  <p className="text-[13px]">{t("changesInPeriod", { list: changesInRange.map((c) => describeChange(c, medName(c.medication_id), t).replace(/^./, (x) => x.toLowerCase())).join("; ") })}</p>
                )}
              </Section>
            )}

            <Section title={t("summaryTitle", { days: days.length })}>
              <div className="grid grid-cols-4 gap-2">
                {[
                  show("bathroom") && { label: t("bathroom"), value: t("bmsCount", { count: bath.series.reduce((s, b) => s + b.value, 0) }), note: bath.headline },
                  show("mood") && { label: t("mood"), value: mood.daily.some((d) => d.avg !== null) ? t("moodAverage", { avg: (mood.daily.filter((d) => d.avg !== null).reduce((s, d) => s + d.avg!, 0) / mood.daily.filter((d) => d.avg !== null).length).toFixed(1) }) : "—", note: mood.averages.length ? t("beforeAfter", { before: mood.averages[0].value.toFixed(1), after: mood.averages[1].value.toFixed(1) }) : t("logsCount", { count: mood.logCount }) },
                  show("mood") && stage !== "baby" && { label: t("behaviors"), value: `${events.length}`, note: beh.headline },
                  show("eating") && (tubeFeeds.length
                    ? { label: t("tube"), value: t("tubePerDay", { amount: tr("eating.ml", { n: Math.round(tubeMl / days.length) }) }), note: t("tubeFeeds", { count: tubeFeeds.length }) }
                    : feeds.length && stage === "baby"
                    ? { label: t("feeding"), value: t("feedsCount", { count: feeds.length }), note: t("aboutPerDay", { count: Math.round(feeds.length / days.length) }) }
                    : { label: t("eating"), value: t("mealsCount", { count: meals.length }), note: meals.length ? t("halfOrMore", { count: halfOrMore, total: meals.length }) : t("noMeals") }),
                ].filter(Boolean).slice(0, 4).map((b) => b && (
                  <div key={b.label} className="border border-foreground rounded-md p-2.5">
                    <p className="text-[12px] font-extrabold uppercase tracking-wide">{b.label}</p>
                    <p className="text-[20px] font-extrabold leading-tight">{b.value}</p>
                    <p className="text-[12px] leading-snug text-foreground-2">{b.note}</p>
                  </div>
                ))}
              </div>
            </Section>

            {show("mood") && mood.daily.some((d) => d.avg !== null) && (
              <Section title={t("moodTitle", { from: shortDate(from), to: shortDate(to) })}>
                <div role="img" aria-label={mood.headline}><MoodLine data={mood.daily} markers={markers} averages={mood.averages} height={200} /></div>
                <p className="text-[13px]">{[t("moodNote", { low: lowMood.toLowerCase(), high: highMood.toLowerCase() }), markers.length ? t("markerNote") : null, mood.averages.length ? t("averagesNote", { before: mood.averages[0].value.toFixed(1), after: mood.averages[1].value.toFixed(1) }) : null].filter(Boolean).join(" ")}</p>
              </Section>
            )}

            {show("bathroom") && (
              <Section title={t("bathroomTitle", { from: shortDate(from), to: shortDate(to) })}>
                <div role="img" aria-label={bath.headline}><DailyBars data={bath.series} bands={bath.bands.map((b) => ({ ...b, label: t("noBm") }))} markers={markers} height={170} /></div>
                <p className="text-[13px]">{t("bmsPerDay", { headline: bath.headline })}{settings.bm_alert_days ? ` ${t("familyAlert", { days: settings.bm_alert_days })}` : ""}</p>
              </Section>
            )}

            {show("mood") && behaviorRows.length > 0 && (
              <Section title={t("behaviors")}>
                <Table columns={[t("colBehavior"), t("colIntensity"), t("colTimeOfDay"), t("colTimes")]} rows={behaviorRows} />
              </Section>
            )}

            {show("eating") && meals.length > 0 && (
              <Section title={t("eating")}>
                <Table
                  columns={[t("colMeal"), t("colLogged"), t("colHalf")]}
                  rows={["breakfast", "lunch", "dinner", "snack"].map((k) => {
                    const ms = meals.filter((e) => (dataOf(e).meal_type ?? dataOf(e).method) === k);
                    return [tr(`options.mealOrSnack.${k}`), ms.length, ms.length ? t("ofTotal", { count: ms.filter((e) => Number(dataOf(e).portion_pct) >= 50).length, total: ms.length }) : "—"];
                  }).filter((r) => r[1] !== 0)}
                />
              </Section>
            )}

            {show("activity") && (
              <Section title={t("activities")}>
                <Table
                  columns={[t("colActivity"), t("colTimes"), t("colEnjoyment"), t("colMinutes")]}
                  rows={activityStats(inRange).slice(0, 8).map((a) => [activityLabel(a.key), a.count, a.enjoyment ? t("enjoymentOf", { score: a.enjoyment.toFixed(1) }) : t("notRated"), a.minutes || "—"])}
                />
              </Section>
            )}

            {show("flagged") && (
              <Section title={t("flaggedTitle")}>
                {flagged.length ? (
                  <>
                    {/* RPT-03: keep a 30-day report within 3 pages; the full list is in the CSV export. */}
                    <Table columns={[t("colWhen"), t("colWhat"), t("colBy")]} rows={flagged.slice(0, 12).map((f) => [f.when, f.what, f.by])} />
                    {flagged.length > 12 && <p className="text-[13px]">{t("flaggedMore", { count: flagged.length - 12 })}</p>}
                  </>
                ) : (
                  <p className="text-[14px]">{t("nothingFlagged")}</p>
                )}
              </Section>
            )}

            {show("patterns") && patternLines.length > 0 && (
              <Section title={t("patternsTitle")}>
                <ul className="list-disc pl-5 text-[14px] leading-[1.45] space-y-1">{patternLines.map((l) => <li key={l}>{l}</li>)}</ul>
                <p className="text-[13px] font-bold">{notProof()}</p>
              </Section>
            )}

            {show("questions") && questions.length > 0 && (
              <Section title={t("questionsTitle")}>
                <ol className="list-decimal pl-5 text-[14px] leading-[1.45] space-y-4">
                  {questions.map((q) => (
                    <li key={q} className="report-section">
                      {q}
                      <span aria-hidden="true" className="block mt-6 border-b border-foreground-2" />
                    </li>
                  ))}
                </ol>
              </Section>
            )}
          </>
        )}

        <footer className="report-section pt-4 mt-2 border-t border-border text-[12px] text-foreground-2">
          {t("footer")}
        </footer>
      </article>
    </div>
  );
}
