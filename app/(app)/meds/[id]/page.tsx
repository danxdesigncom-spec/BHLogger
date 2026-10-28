"use client";

import Link from "next/link";
import { use, useMemo } from "react";
import { Pencil } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useHousehold } from "@/lib/context/household-provider";
import { useEntries, useMedicationChanges, useMedications } from "@/lib/data/hooks";
import type { MedicationChangeRow } from "@/lib/data/types";
import { formatClock } from "@/lib/entries/summary";
import { DOSE_OUTCOMES, formatDose, labelFor, PRN_REASONS } from "@/lib/options";
import { adherence, describeSchedule } from "@/lib/meds/schedule";
import { fromYmd, shortDate } from "@/lib/dates";

function describeChange(c: MedicationChangeRow): string {
  const b = c.before as { default_dose?: number; dose_unit?: string };
  const a = c.after as { default_dose?: number; dose_unit?: string };
  switch (c.change_type) {
    case "started": return a.default_dose ? `Started at ${formatDose(a.default_dose, a.dose_unit ?? "")}` : "Started";
    case "stopped": return "Stopped";
    case "dose_changed": return `Dose changed from ${formatDose(b.default_dose ?? 0, b.dose_unit ?? "")} to ${formatDose(a.default_dose ?? 0, a.dose_unit ?? "")}`;
    case "schedule_changed": return "Schedule changed";
  }
}

export default function MedicationHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { activeProfile, currentMember } = useHousehold();
  const meds = useMedications(activeProfile?.id ?? null);
  const changes = useMedicationChanges(activeProfile?.id ?? null);
  const since = useMemo(() => new Date(Date.now() - 30 * 86_400_000), []);
  const doses = useEntries({ profileId: activeProfile?.id, types: ["medication"], from: since.toISOString() }, !!activeProfile);

  const med = meds.data?.find((m) => m.id === id);
  const mine = (doses.data ?? []).filter((d) => (d.data as { medication_id?: string }).medication_id === id);
  const medChanges = (changes.data ?? []).filter((c) => c.medication_id === id).sort((a, b) => b.effective_at.localeCompare(a.effective_at));
  const adh = med && med.kind === "scheduled" ? adherence(med, mine, since, new Date(), new Date()) : null;

  if (!med) {
    return (
      <>
        <PageHeader title="Medication" backHref="/meds" />
        <p className="px-5 pt-4 text-body text-muted-foreground">{meds.isLoading ? "Loading…" : "Not found for this profile."}</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={med.name}
        subtitle={`for ${activeProfile?.name ?? ""} · ${med.active ? describeSchedule(med) : "stopped"}`}
        backHref="/meds"
        backLabel="Back to Medications"
        action={
          currentMember.role !== "viewer" && (
            <Link href={`/meds/${id}/edit`} className="min-h-touch-min flex items-center gap-1.5 px-4 rounded-full bg-card shadow-raised text-body font-extrabold text-profile-ink">
              <Pencil size={16} strokeWidth={2} aria-hidden="true" /> Edit
            </Link>
          )
        }
      />
      <div className="px-5 pt-3 pb-8 space-y-5">
        <dl className="grid grid-cols-2 gap-2">
          {[
            ["Saved dose", formatDose(Number(med.default_dose), med.dose_unit)],
            ["Form", med.form ?? "—"],
            ["Min. between doses", med.min_interval_hours ? `${med.min_interval_hours} h` : "Not set"],
            ...(adh ? [["Last 30 days", adh.pct === null ? "No doses yet" : `${adh.pct}% given`]] : []),
          ].map(([k, v]) => (
            <div key={k} className="rounded-card bg-card shadow-card p-3.5">
              <dt className="text-caption text-muted-foreground">{k}</dt>
              <dd className="text-body-md">{v}</dd>
            </div>
          ))}
        </dl>

        {adh && adh.scheduled > 0 && (
          <p className="text-caption text-muted-foreground">
            {adh.given} given, {adh.partial} partial, {adh.refused} refused, {adh.spitUp} spit up, {adh.skipped} skipped, {adh.notLogged} not logged, of {adh.scheduled} scheduled.
          </p>
        )}

        <section aria-labelledby="changes-h" className="space-y-2">
          <h2 id="changes-h" className="font-display text-title-5">History and dose changes</h2>
          <ol className="rounded-card bg-card shadow-card divide-y divide-divider">
            {medChanges.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 min-h-[56px] px-3.5 py-2">
                <span className="text-body">{describeChange(c)}</span>
                <span className="text-caption font-bold text-muted-foreground whitespace-nowrap">from {shortDate(fromYmd(c.effective_at))}</span>
              </li>
            ))}
            {!medChanges.length && <li className="px-3.5 py-4 text-caption text-muted-foreground">No changes recorded.</li>}
          </ol>
        </section>

        <section aria-labelledby="doses-h" className="space-y-2">
          <h2 id="doses-h" className="font-display text-title-5">Doses, last 30 days</h2>
          <ol className="rounded-card bg-card shadow-card divide-y divide-divider">
            {mine.slice(0, 40).map((d) => {
              const data = d.data as { dose?: number; unit?: string; outcome?: string; prn_reason?: string | null; duplicate_override?: boolean };
              return (
                <li key={d.id} className="flex items-center justify-between gap-3 min-h-[56px] px-3.5 py-2">
                  <span className="flex flex-col">
                    <span className="text-body font-extrabold">
                      {labelFor(DOSE_OUTCOMES, data.outcome ?? "given")} · {formatDose(data.dose ?? 0, data.unit ?? "")}
                    </span>
                    <span className="text-caption text-muted-foreground">
                      {[data.prn_reason ? labelFor(PRN_REASONS, data.prn_reason) : null, data.duplicate_override ? "extra dose confirmed" : null, d.logged_by_name].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="text-caption font-bold text-muted-foreground tabular-nums whitespace-nowrap">
                    {shortDate(new Date(d.occurred_at))}, {formatClock(d.occurred_at)}
                  </span>
                </li>
              );
            })}
            {!mine.length && <li className="px-3.5 py-4 text-caption text-muted-foreground">No doses logged in the last 30 days.</li>}
          </ol>
        </section>
      </div>
    </>
  );
}
