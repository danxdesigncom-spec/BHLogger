"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Clock } from "lucide-react";
import { LogSheet, type ModuleFormContext } from "@/components/log/LogSheet";
import { Group, RadioChips, Stepper } from "@/components/log/controls";
import type { ToastEntry } from "@/components/log/UndoToast";
import { useHousehold } from "@/lib/context/household-provider";
import { useEntries, useProfileSettings } from "@/lib/data/hooks";
import type { MedicationRow } from "@/lib/data/types";
import { formatClock } from "@/lib/entries/summary";
import { DOSE_OUTCOMES, formatDose, PRN_REASONS } from "@/lib/options";
import { duplicateCheck, formatElapsed, formatHours, lastDose, slotToFill, type DuplicateConflict } from "@/lib/meds/schedule";

interface Props {
  med: MedicationRow | null;
  open: boolean;
  onClose: () => void;
  onSaved: (toast: ToastEntry) => void;
}

export function GiveDoseSheet({ med, open, onClose, onSaved }: Props) {
  const { activeProfile } = useHousehold();
  const settings = useProfileSettings(activeProfile?.id ?? null);
  const since = useMemo(() => new Date(Date.now() - 3 * 86_400_000).toISOString(), [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const doses = useEntries({ profileId: activeProfile?.id, types: ["medication"], from: since }, open && !!activeProfile);
  const [conflict, setConflict] = useState<DuplicateConflict | null>(null);
  const resolver = useRef<((proceed: boolean) => void) | null>(null);

  if (!med) return null;
  const all = doses.data ?? [];
  const now = new Date();
  const slot = med.kind === "scheduled" ? slotToFill(med, all, now) : null;
  const last = lastDose(med, all);
  const intervalHours = med.min_interval_hours ?? settings.med_duplicate_window_min / 60;
  const lastElapsed = last ? Math.round((now.getTime() - new Date(last.occurred_at).getTime()) / 60_000) : null;
  const insideInterval = lastElapsed !== null && lastElapsed < intervalHours * 60;

  const confirmSave = async ({ data, occurredAt }: { data: Record<string, unknown>; occurredAt: Date }) => {
    const outcome = String(data.outcome);
    if (outcome !== "given" && outcome !== "partial") return data;
    const hit = duplicateCheck(med, all, occurredAt, slot, settings.med_duplicate_window_min);
    if (!hit) return data;
    setConflict(hit);
    const proceed = await new Promise<boolean>((resolve) => { resolver.current = resolve; });
    setConflict(null);
    return proceed ? { ...data, duplicate_override: true } : null;
  };

  const decide = (proceed: boolean) => {
    resolver.current?.(proceed);
    resolver.current = null;
  };

  return (
    <>
      <LogSheet
        module="medication"
        moduleLabel="Medication"
        title={med.name}
        subtitle={med.kind === "prn" ? "as needed" : slot ? `due ${formatClock(slot.toISOString())}` : "scheduled"}
        saveLabel="Save dose"
        open={open}
        onClose={onClose}
        onSaved={onSaved}
        confirmSave={confirmSave}
      >
        {(ctx) => (
          <DoseForm
            key={med.id}
            ctx={ctx}
            med={med}
            slot={slot}
            lastHint={
              last
                ? {
                    text: `Last given ${formatClock(last.occurred_at)} by ${last.logged_by_name} (${formatElapsed(lastElapsed!)} ago)`,
                    setting: `Your setting: at least ${formatHours(intervalHours).replace(" hours", " h").replace(" hour", " h")} between doses`,
                    warn: insideInterval,
                  }
                : null
            }
          />
        )}
      </LogSheet>

      {conflict && (
        <DuplicateDoseDialog
          medName={med.name}
          profileName={activeProfile?.name ?? ""}
          conflict={conflict}
          onCancel={() => decide(false)}
          onConfirm={() => decide(true)}
        />
      )}
    </>
  );
}

export function DoseForm({
  ctx, med, slot, lastHint, initial,
}: {
  ctx: ModuleFormContext;
  med: MedicationRow;
  slot: Date | null;
  lastHint: { text: string; setting: string; warn: boolean } | null;
  initial?: Record<string, unknown>;
}) {
  const init = (initial ?? {}) as { dose?: number; outcome?: string; prn_reason?: string | null; duplicate_override?: boolean };
  const [dose, setDose] = useState(init.dose ?? Number(med.default_dose));
  const [outcome, setOutcome] = useState(init.outcome ?? "given");
  const [reason, setReason] = useState<string | null>(init.prn_reason ?? null);
  const step = Number(med.default_dose) >= 10 ? 1 : 0.5;

  useEffect(() => {
    ctx.setData(
      {
        medication_id: med.id, dose, unit: med.dose_unit, outcome,
        scheduled_for: slot ? slot.toISOString() : null,
        prn_reason: med.kind === "prn" ? reason : null,
        duplicate_override: init.duplicate_override ?? false, followup: (initial?.followup as string | null | undefined) ?? null,
      },
      `${med.name} ${formatDose(dose, med.dose_unit)}`,
      true,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dose, outcome, reason, slot?.getTime()]);

  return (
    <div className="space-y-4">
      {lastHint && (
        <div className={`flex items-start gap-2.5 p-3 rounded-[18px] border ${lastHint.warn ? "bg-warning border-warning-border text-warning-ink" : "bg-secondary border-border text-foreground-2"}`}>
          <Clock size={20} strokeWidth={2} className="flex-none mt-0.5" aria-hidden="true" />
          <div className="flex flex-col">
            <span className="text-label font-extrabold">{lastHint.text}</span>
            <span className="text-caption">{lastHint.setting}</span>
          </div>
        </div>
      )}

      <Group label="Dose">
        <Stepper
          display={formatDose(dose, med.dose_unit)}
          caption={dose === Number(med.default_dose) ? "Saved dose" : dose === Number(med.default_dose) / 2 ? "Half dose" : "Changed from saved dose"}
          onDecrease={() => setDose((d) => Math.max(step, Math.round((d - step) * 100) / 100))}
          onIncrease={() => setDose((d) => Math.round((d + step) * 100) / 100)}
          decreaseLabel="Decrease dose"
          increaseLabel="Increase dose"
          canDecrease={dose > step}
        />
        <div className="flex gap-2">
          <button
            type="button"
            aria-pressed={dose === Number(med.default_dose) / 2}
            onClick={() => setDose(dose === Number(med.default_dose) / 2 ? Number(med.default_dose) : Number(med.default_dose) / 2)}
            className={`min-h-touch-min px-4 rounded-full border text-body ${dose === Number(med.default_dose) / 2 ? "bg-profile border-profile text-on-profile font-extrabold" : "bg-secondary border-border"}`}
          >
            Half dose
          </button>
        </div>
      </Group>

      <Group label="What happened?">
        <RadioChips label="What happened" value={outcome} onChange={setOutcome} options={DOSE_OUTCOMES.map((o) => ({ value: o.key, label: o.key === "spit_up_vomited" ? "Spit up" : o.label }))} />
      </Group>

      {med.kind === "prn" && (
        <Group label="Reason">
          <RadioChips label="Reason" value={reason} onChange={(r) => setReason(r === reason ? null : r)} options={PRN_REASONS.map((r) => ({ value: r.key, label: r.label }))} />
        </Group>
      )}
    </div>
  );
}

export function DuplicateDoseDialog({
  medName, profileName, conflict, onCancel, onConfirm,
}: {
  medName: string;
  profileName: string;
  conflict: DuplicateConflict;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const d = conflict.dose.data as { dose?: number; unit?: string };
  const when = formatClock(conflict.dose.occurred_at);
  const title =
    conflict.reason === "slot"
      ? `${medName} was already given today at ${when}`
      : `${medName} was already given ${formatElapsed(conflict.elapsedMin)} ago`;
  const body =
    conflict.reason === "slot"
      ? `${conflict.dose.logged_by_name} logged ${formatDose(d.dose ?? 0, d.unit ?? "")} for this dose.`
      : `${conflict.dose.logged_by_name} logged ${formatDose(d.dose ?? 0, d.unit ?? "")} at ${when}. Your setting for ${profileName} is at least ${formatHours(conflict.intervalHours)} between doses.`;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-6 bg-[var(--overlay-strong)] animate-fade-in">
      <div role="alertdialog" aria-modal="true" aria-labelledby="dup-title" aria-describedby="dup-body" className="w-full max-w-sm rounded-tile bg-card p-6 shadow-dialog flex flex-col items-center gap-3 text-center">
        <span className="w-14 h-14 rounded-full bg-warning text-warning-ink flex items-center justify-center">
          <AlertTriangle size={28} strokeWidth={2} aria-hidden="true" />
        </span>
        <h2 id="dup-title" className="font-display text-title-2">{title}</h2>
        <p id="dup-body" className="text-body text-foreground-2">{body}</p>
        <button type="button" autoFocus onClick={onCancel} className="w-full h-button rounded-full bg-primary text-primary-foreground text-body-lg mt-1">
          Don&rsquo;t log this dose
        </button>
        <button type="button" onClick={onConfirm} className="w-full h-button rounded-full border-[1.5px] border-border-strong bg-card text-body-lg">
          Log another dose anyway
        </button>
        <p className="text-caption text-muted-foreground">Not sure? Check with {profileName}&rsquo;s doctor or pharmacist.</p>
      </div>
    </div>
  );
}
