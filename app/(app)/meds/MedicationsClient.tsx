"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronRight, Clock, History, Plus, X } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { GiveDoseSheet } from "@/components/meds/GiveDoseSheet";
import { MODULE_ICONS } from "@/components/log/LogSheet";
import { useUndoToast } from "@/components/log/useUndoToast";
import { useHousehold } from "@/lib/context/household-provider";
import { useEntries, useMedications } from "@/lib/data/hooks";
import type { MedicationRow } from "@/lib/data/types";
import { formatClock, formatWhen } from "@/lib/entries/summary";
import { formatDose, labelFor, DOSE_OUTCOMES } from "@/lib/options";
import { friendlySchedule, lastDose, todaySlots, type SlotStatus } from "@/lib/meds/schedule";
import { startOfDay } from "@/lib/dates";

type Row = { med: MedicationRow; slot?: SlotStatus };

export function MedicationsClient() {
  const { activeProfile, currentMember } = useHousehold();
  const router = useRouter();
  const params = useSearchParams();
  const giveId = params.get("give");
  const { showToast, toastElement } = useUndoToast();

  const meds = useMedications(activeProfile?.id ?? null);
  const since = useMemo(() => new Date(Date.now() - 2 * 86_400_000).toISOString(), []);
  const doses = useEntries({ profileId: activeProfile?.id, types: ["medication"], from: since }, !!activeProfile);

  const now = new Date();
  const all = doses.data ?? [];
  const active = (meds.data ?? []).filter((m) => m.active);
  const stopped = (meds.data ?? []).filter((m) => !m.active);

  const sections = { overdue: [] as Row[], due: [] as Row[], later: [] as Row[], prn: [] as Row[], given: [] as Row[] };
  for (const med of active) {
    if (med.kind === "prn") {
      sections.prn.push({ med });
      continue;
    }
    for (const slot of todaySlots(med, all, now)) {
      if (slot.state === "not_logged") sections.overdue.push({ med, slot });
      else if (slot.state === "due") sections.due.push({ med, slot });
      else if (slot.state === "upcoming") sections.later.push({ med, slot });
      else sections.given.push({ med, slot });
    }
  }
  const scheduledToday = sections.overdue.length + sections.due.length + sections.later.length + sections.given.length;
  const givenToday = sections.given.filter((r) => r.slot?.state === "given").length;
  const todayStart = startOfDay(now).toISOString();
  const prnGivenToday = all.filter((d) => d.occurred_at >= todayStart && sections.prn.some((r) => (d.data as { medication_id?: string }).medication_id === r.med.id));

  const giveMed = giveId ? (meds.data ?? []).find((m) => m.id === giveId) ?? null : null;
  const openGive = (id: string) => router.replace(`/meds?give=${id}`, { scroll: false });
  const closeGive = () => router.replace("/meds", { scroll: false });
  const canLog = currentMember.role !== "viewer";

  return (
    <>
      <PageHeader
        title="Medications"
        backHref="/"
        backLabel="Back to Home"
        subtitle={`for ${activeProfile?.name ?? ""}${scheduledToday ? ` · ${givenToday} of ${scheduledToday} given today` : ""}`}
        action={
          canLog && (
            <Link href="/meds/new" className="min-h-touch-min flex items-center gap-1.5 px-4 rounded-full bg-card shadow-raised text-body font-extrabold text-profile-ink">
              <Plus size={18} strokeWidth={2} aria-hidden="true" /> Add
            </Link>
          )
        }
      />

      <div className="px-5 pt-2 pb-6 space-y-5">
        {meds.isLoading && <p className="text-body text-muted-foreground">Loading…</p>}
        {!meds.isLoading && active.length === 0 && (
          <div className="rounded-card bg-card p-5 shadow-card space-y-2">
            <p className="text-body-md">No medications yet</p>
            <p className="text-caption text-muted-foreground">Add medicines and supplements once. Giving a dose is then one tap, and the app warns before a double dose.</p>
          </div>
        )}

        <Section title="Overdue" rows={sections.overdue} render={(r) => (
          <MedRow key={`${r.med.id}-${r.slot!.slot.getTime()}`} med={r.med} status={<Chip tone="warning">Not logged · due {formatClock(r.slot!.slot.toISOString())}</Chip>} onGive={canLog ? () => openGive(r.med.id) : undefined} />
        )} />
        <Section title="Due" rows={sections.due} render={(r) => (
          <MedRow key={`${r.med.id}-${r.slot!.slot.getTime()}`} med={r.med} status={<Chip tone="warning">Due {formatClock(r.slot!.slot.toISOString())}</Chip>} onGive={canLog ? () => openGive(r.med.id) : undefined} />
        )} />
        <Section title="Later today" rows={sections.later} render={(r) => (
          <MedRow key={`${r.med.id}-${r.slot!.slot.getTime()}`} med={r.med} status={<Chip tone="neutral">Due {formatClock(r.slot!.slot.toISOString())}</Chip>} onGive={canLog ? () => openGive(r.med.id) : undefined} giveLabel="Give early" />
        )} />
        <Section title="As needed" rows={sections.prn} render={(r) => {
          const last = lastDose(r.med, all);
          return (
            <MedRow
              key={r.med.id}
              med={r.med}
              onRow={canLog ? () => openGive(r.med.id) : undefined}
              status={
                <span className="flex items-center gap-1.5 text-caption font-bold text-foreground-2">
                  <Clock size={14} strokeWidth={2} aria-hidden="true" />
                  {last ? `Last given ${formatWhen(last.occurred_at)} by ${last.logged_by_name}` : "Not given in the last 2 days"}
                </span>
              }
            />
          );
        }} />

        {(sections.given.length > 0 || prnGivenToday.length > 0) && (
          <section aria-labelledby="given-h" className="space-y-2">
            <h2 id="given-h" className="font-display text-title-5">Given today</h2>
            <div className="rounded-card bg-card shadow-card divide-y divide-divider">
              {sections.given.map((r) => {
                const outcome = (r.slot!.dose!.data as { outcome?: string }).outcome ?? "given";
                return (
                  <GivenRow
                    key={r.slot!.dose!.id}
                    name={r.med.name}
                    sub={`${formatDose(Number(r.med.default_dose), r.med.dose_unit)} · ${friendlySchedule(r.med)}`}
                    ok={r.slot!.state === "given"}
                    label={`${r.slot!.state === "given" ? "" : `${labelFor(DOSE_OUTCOMES, outcome)} · `}${formatClock(r.slot!.dose!.occurred_at)} · ${r.slot!.dose!.logged_by_name}`}
                  />
                );
              })}
              {prnGivenToday.map((d) => {
                const med = sections.prn.find((r) => r.med.id === (d.data as { medication_id?: string }).medication_id)!.med;
                const data = d.data as { dose?: number; unit?: string; outcome?: string };
                return (
                  <GivenRow
                    key={d.id}
                    name={med.name}
                    sub={`${formatDose(data.dose ?? 0, data.unit ?? med.dose_unit)} · as needed`}
                    ok={data.outcome === "given" || data.outcome === "partial"}
                    label={`${formatClock(d.occurred_at)} · ${d.logged_by_name}`}
                  />
                );
              })}
            </div>
          </section>
        )}

        {active.length > 0 && (
          <section aria-labelledby="manage-h" className="space-y-2">
            <h2 id="manage-h" className="font-display text-title-5">Manage</h2>
            <div className="rounded-card bg-card shadow-card divide-y divide-divider">
              {[...active, ...stopped].map((m) => (
                <Link key={m.id} href={`/meds/${m.id}`} className="flex items-center gap-3 min-h-[56px] px-3.5">
                  <span className="flex-1 min-w-0">
                    <span className="block text-body font-extrabold truncate">{m.name}</span>
                    <span className="block text-caption text-muted-foreground">
                      {m.active ? `${formatDose(Number(m.default_dose), m.dose_unit)} · ${friendlySchedule(m)}` : "Stopped"}
                    </span>
                  </span>
                  <span className="flex items-center gap-1 text-caption font-bold text-muted-foreground">
                    <History size={14} strokeWidth={2} aria-hidden="true" /> History
                  </span>
                  <ChevronRight size={18} strokeWidth={2} className="text-muted-foreground" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      <GiveDoseSheet med={giveMed} open={!!giveMed} onClose={closeGive} onSaved={(t) => { showToast(t); closeGive(); }} />
      {toastElement}
    </>
  );
}

function Section({ title, rows, render }: { title: string; rows: Row[]; render: (r: Row) => React.ReactNode }) {
  if (!rows.length) return null;
  const id = `sec-${title.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <section aria-labelledby={id} className="space-y-2">
      <h2 id={id} className="font-display text-title-5">{title}</h2>
      <div className="space-y-2">{rows.map(render)}</div>
    </section>
  );
}

function MedRow({
  med, status, onGive, onRow, giveLabel = "Give",
}: {
  med: MedicationRow;
  status: React.ReactNode;
  onGive?: () => void;
  onRow?: () => void;
  giveLabel?: string;
}) {
  const body = (
    <>
      <span className="w-11 h-11 flex-none rounded-full bg-medication text-medication-ink flex items-center justify-center [&_svg]:w-5 [&_svg]:h-5">
        {MODULE_ICONS.medication}
      </span>
      <span className="flex-1 min-w-0 flex flex-col items-start gap-1 text-left">
        <span className="text-body-lg">{med.name}</span>
        <span className="text-label font-normal text-muted-foreground">
          {formatDose(Number(med.default_dose), med.dose_unit)}{med.form ? ` · ${med.form.toLowerCase()}` : ""} · {friendlySchedule(med)}
        </span>
        {status}
      </span>
    </>
  );
  if (onRow) {
    return (
      <button type="button" onClick={onRow} className="w-full flex items-center gap-3 p-3.5 rounded-card bg-card shadow-card">
        {body}
        <ChevronRight size={20} strokeWidth={2} className="text-muted-foreground" aria-hidden="true" />
      </button>
    );
  }
  return (
    <div className="flex items-center gap-3 p-3.5 rounded-card bg-card shadow-card">
      {body}
      {onGive && (
        <button type="button" onClick={onGive} aria-label={`${giveLabel} ${med.name}`} className="min-h-touch-min px-[18px] flex-none rounded-full bg-primary text-primary-foreground text-body-md">
          {giveLabel}
        </button>
      )}
    </div>
  );
}

function GivenRow({ name, sub, label, ok }: { name: string; sub: string; label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-3 min-h-16 px-3.5 py-2">
      <span className="flex-1 min-w-0">
        <span className="block text-body-md truncate">{name}</span>
        <span className="block text-label font-normal text-muted-foreground">{sub}</span>
      </span>
      <Chip tone={ok ? "success" : "warning"} icon={ok ? <Check size={14} strokeWidth={2.5} aria-hidden="true" /> : <X size={14} strokeWidth={2.5} aria-hidden="true" />}>
        {label}
      </Chip>
    </div>
  );
}

function Chip({ tone, icon, children }: { tone: "warning" | "success" | "neutral"; icon?: React.ReactNode; children: React.ReactNode }) {
  const cls = tone === "warning" ? "bg-warning text-warning-ink" : tone === "success" ? "bg-success text-success-ink" : "bg-secondary text-foreground-2";
  return <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-caption font-extrabold ${cls}`}>{icon}{children}</span>;
}

