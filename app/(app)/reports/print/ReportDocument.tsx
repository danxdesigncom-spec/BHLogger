"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, Printer } from "lucide-react";
import { DailyBars, MoodLine } from "@/components/insights/charts";
import { useHousehold } from "@/lib/context/household-provider";
import { useEntries, useMedicationChanges, useMedications, useProfileSettings } from "@/lib/data/hooks";
import { entryDetail, entryTitle, type SummaryContext } from "@/lib/entries/summary";
import { activityStats, blockOf, behaviorEvents, dataOf, eachDay, localParts, tally } from "@/lib/insights/core";
import { bathroomTrend, behaviorTrend, moodTrend } from "@/lib/insights/trends";
import { beforeAfterChange, hardestTimeOfDay, latestChange, moodAndBms, NOT_PROOF } from "@/lib/insights/patterns";
import { adherence, describeSchedule } from "@/lib/meds/schedule";
import { activityLabel, ageLabel, behaviorLabel, formatDose, humanize, labelFor, PRN_REASONS } from "@/lib/options";
import { flaggedEvents } from "@/lib/reports/flagged";
import { savedQuestions, TEMPLATES, type SectionKey, type TemplateKey } from "@/lib/reports/templates";
import { reportItems, type ReportItem } from "@/lib/report-items";
import { fromYmd, shortDate } from "@/lib/dates";
import type { MedicationChangeRow } from "@/lib/data/types";

const longDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

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

function describeChange(c: MedicationChangeRow, name: string) {
  const b = c.before as { default_dose?: number; dose_unit?: string };
  const a = c.after as { default_dose?: number; dose_unit?: string };
  const when = longDate(fromYmd(c.effective_at));
  if (c.change_type === "dose_changed") return `${name} dose changed from ${formatDose(b.default_dose ?? 0, b.dose_unit ?? "")} to ${formatDose(a.default_dose ?? 0, a.dose_unit ?? "")} on ${when}`;
  if (c.change_type === "started") return `${name} started ${when}`;
  if (c.change_type === "stopped") return `${name} stopped ${when}`;
  return `${name} schedule changed ${when}`;
}

export function ReportDocument() {
  const params = useSearchParams();
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
  const medName = (id: string) => meds.data?.find((m) => m.id === id)?.name ?? "Medication";
  const ctx: SummaryContext = { careStage: stage, toileting: profile.toileting, volumeUnit: householdSettings.volume_unit, medicationName: medName };
  const changesInRange = (changes.data ?? []).filter((c) => c.effective_at >= fromStr && c.effective_at <= toStr);
  const markers = changesInRange.map((c) => ({
    day: c.effective_at,
    label: `${medName(c.medication_id)} ${c.change_type === "dose_changed" ? "dose changed" : c.change_type === "started" ? "started" : c.change_type === "stopped" ? "stopped" : "schedule changed"}`,
  }));

  const mood = moodTrend(inRange, [], days, markers, stage);
  const bath = bathroomTrend(inRange, [], days, from, to, stage, profile.toileting, settings.bm_alert_days);
  const beh = behaviorTrend(inRange, [], days, markers);
  const events = behaviorEvents(inRange);
  const meals = inRange.filter((e) => e.type === "eating" && ["meal", "snack"].includes(String(dataOf(e).method)) && dataOf(e).portion_pct !== undefined);
  const halfOrMore = meals.filter((e) => Number(dataOf(e).portion_pct) >= 50).length;
  const feeds = inRange.filter((e) => e.type === "eating" && ["breast", "bottle"].includes(String(dataOf(e).method)));
  const card = profile.careCard as { allergies?: string[]; conditions?: string[]; communication_notes?: string; calming_strategies?: string[]; doctor?: { name?: string } };
  const flagged = flaggedEvents(inRange, { from, to, bmAlertDays: settings.bm_alert_days, medName, describe: (e) => `${entryTitle(e, ctx)}${entryDetail(e) ? `, ${entryDetail(e).toLowerCase()}` : ""}` });

  const pat01 = hardestTimeOfDay(inRange.filter((e) => new Date(e.occurred_at) >= new Date(to.getTime() - 30 * 86_400_000)));
  const pat02 = moodAndBms(inRange, from, to);
  const change = latestChange((changes.data ?? []).filter((c) => c.change_type !== "started" || c.effective_at >= fromStr), to);
  const pat03 = change ? beforeAfterChange(all, change, to) : null;
  const patternLines: string[] = [];
  if (pat03?.status === "ready") patternLines.push(`Mood averaged ${pat03.after.mood?.toFixed(1)} after the ${medName(change!.medication_id).toLowerCase()} change on ${shortDate(fromYmd(change!.effective_at))}, compared with ${pat03.before.mood?.toFixed(1)} in the ${pat03.window} days before.`);
  if (pat01.status === "ready") {
    const others = pat01.blocks.filter((b) => b.key !== pat01.hardest.key && b.avg !== null);
    const avgOthers = others.reduce((s, b) => s + (b.avg ?? 0), 0) / Math.max(1, others.length);
    patternLines.push(`${pat01.hardest.label} is usually the hardest time (average mood ${pat01.hardest.avg?.toFixed(1)}, compared with about ${avgOthers.toFixed(1)} at other times).`);
  }
  if (pat02.status === "ready") patternLines.push(`On days with no BM, mood averaged ${pat02.without.toFixed(1)}, compared with ${pat02.with.toFixed(1)} on days with one.`);
  for (const i of items) if (!patternLines.some((l) => l.startsWith(i.title.slice(0, 20)))) patternLines.push(`${i.title}.`);

  const behaviorRows = tally(events.map((b) => b.key)).map((t) => {
    const mine = events.filter((b) => b.key === t.key);
    const sev = tally(mine.map((b) => b.severity ?? "")).filter((s) => s.key)[0]?.key;
    const block = tally(mine.map((b) => blockOf(localParts(b.entry).hour).label))[0]?.key;
    return [behaviorLabel(t.key), sev ? humanize(sev) : "—", block ?? "—", t.count];
  });

  const title = TEMPLATES[template]?.title ?? "Care report";
  const show = (s: SectionKey) => sections.has(s);
  const age = ageLabel(profile.dob);

  return (
    <div className="report-wrap">
      <div className="print:hidden flex items-center justify-between gap-3 px-5 pt-[18px] pb-3">
        <Link href="/reports" aria-label="Back to Reports" className="w-11 h-11 rounded-full bg-card shadow-raised flex items-center justify-center">
          <ChevronLeft size={22} strokeWidth={2} aria-hidden="true" />
        </Link>
        <button type="button" onClick={() => window.print()} className="h-button px-5 flex items-center gap-2 rounded-full bg-primary text-primary-foreground text-body-md">
          <Printer size={18} strokeWidth={2} aria-hidden="true" /> Print or save as PDF
        </button>
      </div>

      <article data-theme="light" className="report-doc mx-auto bg-card text-foreground font-sans" aria-label={`${title} for ${profile.name}`}>
        <header className="flex items-center justify-between gap-4 pb-3 border-b-4 border-profile" data-profile-color={profile.color}>
          <span className="flex items-center gap-2 text-[13px] font-extrabold">
            <span aria-hidden="true" className="w-6 h-6 rounded-md bg-profile" /> Behavior Logger
          </span>
          <span className="text-[13px] font-bold text-foreground-2">{title}</span>
        </header>

        <section className="report-section pt-4 space-y-1">
          <h1 className="text-[30px] leading-tight font-extrabold font-sans">{profile.name}</h1>
          <p className="text-[14px]">
            {[age ? `Age ${age}` : null, profile.dob ? `Born ${longDate(fromYmd(profile.dob))}` : null, `Report period ${shortDate(from)} to ${longDate(to)} (${days.length} days)`].filter(Boolean).join(" · ")}
          </p>
          <p className="text-[14px] text-foreground-2">
            Prepared by {currentMember.displayName} on {longDate(new Date())}{card.doctor?.name ? ` for ${card.doctor.name}` : ""}
          </p>
        </section>

        {loading ? (
          <p className="text-[14px] text-foreground-2">Loading…</p>
        ) : (
          <>
            {show("carecard") && (
              <section className="report-section grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <h2 className="text-[18px] font-extrabold font-sans">Allergies</h2>
                  <p className="text-[14px]">{card.allergies?.length ? card.allergies.join(", ") : "None recorded"}</p>
                  {!!card.conditions?.length && <p className="text-[14px] text-foreground-2">Conditions: {card.conditions.join(", ")}</p>}
                </div>
                <div className="space-y-1">
                  <h2 className="text-[18px] font-extrabold font-sans">Care notes</h2>
                  <p className="text-[14px]">{[card.communication_notes, card.calming_strategies?.length ? `Calms with ${card.calming_strategies.join(", ").toLowerCase()}.` : null].filter(Boolean).join(" ") || "None recorded"}</p>
                </div>
              </section>
            )}

            {show("meds") && (
              <Section title="Current medications">
                <Table
                  columns={["Medication", "Dose", "Schedule", "Started", "Given in period"]}
                  rows={(meds.data ?? []).filter((m) => m.active).map((m) => {
                    let given: string;
                    if (m.kind === "scheduled") {
                      const a = adherence(m, inRange as never, from, to, new Date());
                      given = a.scheduled ? `${a.given + a.partial} of ${a.scheduled} (${a.pct}%)` : "—";
                    } else {
                      const prn = inRange.filter((e) => e.type === "medication" && dataOf(e).medication_id === m.id);
                      const reason = tally(prn.map((e) => String(dataOf(e).prn_reason ?? ""))).filter((r) => r.key)[0];
                      given = prn.length ? `${prn.length} dose${prn.length === 1 ? "" : "s"}${reason ? `, for ${labelFor(PRN_REASONS, reason.key).toLowerCase()}` : ""}` : "None";
                    }
                    return [`${m.name}${m.form ? ` (${m.form.toLowerCase()})` : ""}`, formatDose(Number(m.default_dose), m.dose_unit), m.kind === "prn" ? "As needed" : humanize(describeSchedule(m)), m.start_date ? longDate(fromYmd(m.start_date)) : "—", given];
                  })}
                />
                {changesInRange.length > 0 && (
                  <p className="text-[13px]">Change in this period: {changesInRange.map((c) => describeChange(c, medName(c.medication_id)).replace(/^./, (x) => x.toLowerCase())).join("; ")}.</p>
                )}
              </Section>
            )}

            <Section title={`${days.length}-day summary`}>
              <div className="grid grid-cols-4 gap-2">
                {[
                  show("bathroom") && { label: "Bathroom", value: `${bath.series.reduce((s, b) => s + b.value, 0)} BMs`, note: bath.headline },
                  show("mood") && { label: "Mood", value: mood.daily.some((d) => d.avg !== null) ? `${(mood.daily.filter((d) => d.avg !== null).reduce((s, d) => s + d.avg!, 0) / mood.daily.filter((d) => d.avg !== null).length).toFixed(1)} average` : "—", note: mood.averages.length ? `${mood.averages[0].value.toFixed(1)} before, ${mood.averages[1].value.toFixed(1)} after` : `${mood.logCount} logs` },
                  show("mood") && stage !== "baby" && { label: "Behaviors", value: `${events.length}`, note: beh.headline },
                  show("eating") && (feeds.length && stage === "baby"
                    ? { label: "Feeding", value: `${feeds.length} feeds`, note: `About ${Math.round(feeds.length / days.length)} a day` }
                    : { label: "Eating", value: `${meals.length} meals`, note: meals.length ? `Ate half or more at ${halfOrMore} of ${meals.length}` : "No meals logged" }),
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
              <Section title={`Mood, ${shortDate(from)} to ${shortDate(to)}`}>
                <div role="img" aria-label={mood.headline}><MoodLine data={mood.daily} markers={markers} averages={mood.averages} height={200} /></div>
                <p className="text-[13px]">Daily average mood, {mood.caption.split("· ")[1]}. {markers.length ? "Dashed line: medication change. " : ""}{mood.averages.length ? `Dotted lines: average before (${mood.averages[0].value.toFixed(1)}) and after (${mood.averages[1].value.toFixed(1)}).` : ""}</p>
              </Section>
            )}

            {show("bathroom") && (
              <Section title={`Bathroom, ${shortDate(from)} to ${shortDate(to)}`}>
                <div role="img" aria-label={bath.headline}><DailyBars data={bath.series} bands={bath.bands.map((b) => ({ ...b, label: "No BM" }))} markers={markers} height={170} /></div>
                <p className="text-[13px]">BMs per day. {bath.headline}. {settings.bm_alert_days ? `Family alert is set at ${settings.bm_alert_days} days without a BM.` : ""}</p>
              </Section>
            )}

            {show("mood") && behaviorRows.length > 0 && (
              <Section title="Behaviors">
                <Table columns={["Behavior", "Usual intensity", "Usual time of day", "Times"]} rows={behaviorRows} />
              </Section>
            )}

            {show("eating") && meals.length > 0 && (
              <Section title="Eating">
                <Table
                  columns={["Meal", "Logged", "Ate half or more"]}
                  rows={["breakfast", "lunch", "dinner", "snack"].map((k) => {
                    const ms = meals.filter((e) => (dataOf(e).meal_type ?? dataOf(e).method) === k);
                    return [humanize(k), ms.length, ms.length ? `${ms.filter((e) => Number(dataOf(e).portion_pct) >= 50).length} of ${ms.length}` : "—"];
                  }).filter((r) => r[1] !== 0)}
                />
              </Section>
            )}

            {show("activity") && (
              <Section title="Activities">
                <Table
                  columns={["Activity", "Times", "Average enjoyment", "Minutes"]}
                  rows={activityStats(inRange).slice(0, 8).map((a) => [activityLabel(a.key), a.count, a.enjoyment ? `${a.enjoyment.toFixed(1)} of 5` : "Not rated", a.minutes || "—"])}
                />
              </Section>
            )}

            {show("flagged") && (
              <Section title="Flagged for the doctor">
                {flagged.length ? (
                  <>
                    {/* RPT-03: keep a 30-day report within 3 pages; the full list is in the CSV export. */}
                    <Table columns={["When", "What happened", "Logged by"]} rows={flagged.slice(0, 12).map((f) => [f.when, f.what, f.by])} />
                    {flagged.length > 12 && <p className="text-[13px]">The 12 most recent are shown; {flagged.length - 12} more are in the CSV export.</p>}
                  </>
                ) : (
                  <p className="text-[14px]">Nothing flagged in this period.</p>
                )}
              </Section>
            )}

            {show("patterns") && patternLines.length > 0 && (
              <Section title="Patterns the app noticed">
                <ul className="list-disc pl-5 text-[14px] leading-[1.45] space-y-1">{patternLines.map((l) => <li key={l}>{l}</li>)}</ul>
                <p className="text-[13px] font-bold">{NOT_PROOF}</p>
              </Section>
            )}

            {show("questions") && questions.length > 0 && (
              <Section title="Questions for this visit">
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
          Made with Behavior Logger from caregiver entries. Not a medical record or diagnosis.
        </footer>
      </article>
    </div>
  );
}
