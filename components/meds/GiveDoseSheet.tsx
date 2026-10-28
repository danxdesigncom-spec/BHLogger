"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { LogSheet, type ModuleFormContext } from "@/components/log/LogSheet";
import { Group, RadioChips, Stepper } from "@/components/log/controls";
import type { ToastEntry } from "@/components/log/UndoToast";
import { useHousehold } from "@/lib/context/household-provider";
import { useEntries, useProfileSettings } from "@/lib/data/hooks";
import type { MedicationRow } from "@/lib/data/types";
import { formatClock } from "@/lib/entries/summary";
import { DOSE_OUTCOMES, formatDose, PRN_REASONS } from "@/lib/options";
import { useOptionSet } from "@/lib/data/useOptionSet";
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
  const t = useTranslations();

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
        moduleLabel={t("modules.medication")}
        title={med.name}
        subtitle={med.kind === "prn" ? t("meds.dose.asNeeded") : slot ? t("meds.dose.due", { time: formatClock(slot.toISOString()) }) : t("meds.dose.scheduled")}
        saveLabel={t("meds.dose.save")}
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
                    text: t("meds.dose.lastGiven", { time: formatClock(last.occurred_at), name: last.logged_by_name, elapsed: formatElapsed(lastElapsed!) }),
                    setting: t("meds.dose.setting", { hours: intervalHours < 1 ? formatHours(intervalHours) : t("meds.hoursShort", { count: Number(intervalHours.toFixed(1)) }) }),
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
  const reasons = useOptionSet(med.profile_id, "prn_reason", [...PRN_REASONS]).options;
  const t = useTranslations("meds.dose");
  const to = useTranslations("options.doseOutcome");

  useEffect(() => {
    ctx.setData(
      {
        medication_id: med.id, dose, unit: med.dose_unit, outcome,
        scheduled_for: slot ? slot.toISOString() : null,
        prn_reason: med.kind === "prn" ? reason : null,
        duplicate_override: init.duplicate_override ?? false, followup: (initial?.followup as string | null | undefined) ?? null,
      },
      t("summary", { name: med.name, dose: formatDose(dose, med.dose_unit) }),
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

      <Group label={t("dose")}>
        <Stepper
          display={formatDose(dose, med.dose_unit)}
          caption={dose === Number(med.default_dose) ? t("savedDose") : dose === Number(med.default_dose) / 2 ? t("halfDose") : t("changed")}
          onDecrease={() => setDose((d) => Math.max(step, Math.round((d - step) * 100) / 100))}
          onIncrease={() => setDose((d) => Math.round((d + step) * 100) / 100)}
          decreaseLabel={t("decrease")}
          increaseLabel={t("increase")}
          canDecrease={dose > step}
        />
        <div className="flex gap-2">
          <button
            type="button"
            aria-pressed={dose === Number(med.default_dose) / 2}
            onClick={() => setDose(dose === Number(med.default_dose) / 2 ? Number(med.default_dose) : Number(med.default_dose) / 2)}
            className={`min-h-touch-min px-4 rounded-full border text-body ${dose === Number(med.default_dose) / 2 ? "bg-profile border-profile text-on-profile font-extrabold" : "bg-secondary border-border"}`}
          >
            {t("halfDose")}
          </button>
        </div>
      </Group>

      <Group label={t("whatHappened")}>
        <RadioChips label={t("whatHappenedLabel")} value={outcome} onChange={setOutcome} options={DOSE_OUTCOMES.map((o) => ({ value: o.key, label: o.key === "spit_up_vomited" ? to("spit_up_short") : o.label }))} />
      </Group>

      {med.kind === "prn" && (
        <Group label={t("reason")}>
          <RadioChips label={t("reason")} value={reason} onChange={(r) => setReason(r === reason ? null : r)} options={reasons.map((r) => ({ value: r.key, label: r.label }))} />
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
  const t = useTranslations("meds.duplicate");
  const d = conflict.dose.data as { dose?: number; unit?: string };
  const when = formatClock(conflict.dose.occurred_at);
  const by = conflict.dose.logged_by_name;
  const dose = formatDose(d.dose ?? 0, d.unit ?? "");
  const title =
    conflict.reason === "slot"
      ? t("slotTitle", { name: medName, time: when })
      : t("recentTitle", { name: medName, elapsed: formatElapsed(conflict.elapsedMin) });
  const body =
    conflict.reason === "slot"
      ? t("slotBody", { by, dose })
      : t("recentBody", { by, dose, time: when, profile: profileName, hours: formatHours(conflict.intervalHours) });

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
          {t("cancel")}
        </button>
        <button type="button" onClick={onConfirm} className="w-full h-button rounded-full border-[1.5px] border-border-strong bg-card text-body-lg">
          {t("confirm")}
        </button>
        <p className="text-caption text-muted-foreground">{t("check", { name: profileName })}</p>
      </div>
    </div>
  );
}
