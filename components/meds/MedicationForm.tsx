"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Group, Notice, RadioChips, Stepper } from "@/components/log/controls";
import { useHousehold } from "@/lib/context/household-provider";
import { useRepo } from "@/lib/data/repo-context";
import type { MedicationRow } from "@/lib/data/types";
import { DOSE_UNITS, doseUnitName, MED_FORMS, medFormLabel } from "@/lib/options";
import { ymd } from "@/lib/dates";
import { formatTime } from "@/lib/prefs";


const inputClass = "w-full h-button rounded-lg border border-input bg-card px-4 text-[16px] font-bold text-foreground placeholder:font-normal placeholder:text-muted-foreground";

function to12h(t: string) {
  const [h, m] = t.split(":").map(Number);
  return formatTime(new Date(2000, 0, 1, h, m));
}

export function MedicationForm({ existing }: { existing?: MedicationRow }) {
  const { activeProfile } = useHousehold();
  const repo = useRepo();
  const router = useRouter();
  const t = useTranslations("meds.form");
  const tc = useTranslations("common");
  const days7 = t.raw("days") as string[];
  const qc = useQueryClient();
  const sched = existing?.schedule as { times?: string[]; days?: number[] } | null | undefined;

  const [name, setName] = useState(existing?.name ?? "");
  const [form, setForm] = useState<string | null>(existing?.form ?? null);
  const [allForms, setAllForms] = useState(false);
  const [dose, setDose] = useState(existing ? String(existing.default_dose) : "");
  const [unit, setUnit] = useState(existing?.dose_unit ?? "mg");
  const [kind, setKind] = useState<"scheduled" | "prn">(existing?.kind ?? "scheduled");
  const [times, setTimes] = useState<string[]>(sched?.times ?? ["08:00"]);
  const [days, setDays] = useState<number[]>(sched?.days ?? [0, 1, 2, 3, 4, 5, 6]);
  const [newTime, setNewTime] = useState("");
  const [minHours, setMinHours] = useState<number | null>(existing?.min_interval_hours ?? null);
  const [windowMin, setWindowMin] = useState(existing?.dose_window_min ?? 60);
  const [more, setMore] = useState(false);
  const [strength, setStrength] = useState(existing?.strength ?? "");
  const [purpose, setPurpose] = useState(existing?.purpose ?? "");
  const [prescriber, setPrescriber] = useState(existing?.prescriber ?? "");
  const [instructions, setInstructions] = useState(existing?.instructions ?? "");
  const [startDate, setStartDate] = useState(existing?.start_date ?? ymd(new Date()));
  const [endDate, setEndDate] = useState(existing?.end_date ?? "");
  const [effectiveFrom, setEffectiveFrom] = useState(ymd(new Date()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doseNum = Number(dose);
  const schedule = kind === "scheduled" ? { times: [...times].sort(), days: [...days].sort() } : null;
  const doseChanged = !!existing && (Number(existing.default_dose) !== doseNum || existing.dose_unit !== unit);
  const scheduleChanged = !!existing && (existing.kind !== kind || JSON.stringify(existing.schedule ?? null) !== JSON.stringify(schedule));
  const shownForms = allForms ? MED_FORMS : MED_FORMS.filter((f) => ["Liquid", "Tablet", "Chewable", "Capsule", "Drops"].includes(f) || f === form);

  const save = async (active = true) => {
    if (!activeProfile) return;
    if (!name.trim()) return setError(t("nameRequired"));
    if (!(doseNum > 0)) return setError(t("doseRequired"));
    if (kind === "scheduled" && (!times.length || !days.length)) return setError(t("scheduleRequired"));
    setSaving(true);
    setError(null);
    const result = await repo.saveMedication({
      id: existing?.id,
      profileId: existing?.profile_id ?? activeProfile.id,
      name: name.trim(),
      form,
      strength: strength.trim() || null,
      defaultDose: doseNum,
      doseUnit: unit,
      kind,
      schedule,
      doseWindowMin: windowMin,
      minIntervalHours: minHours,
      purpose: purpose.trim() || null,
      prescriber: prescriber.trim() || null,
      instructions: instructions.trim() || null,
      startDate: startDate || null,
      endDate: active ? endDate || null : ymd(new Date()),
      active,
      effectiveFrom: doseChanged || scheduleChanged || !active ? effectiveFrom : undefined,
    });
    setSaving(false);
    if ("error" in result) return setError(result.error);
    await Promise.all(["medications", "med-changes"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
    router.push(existing ? `/meds/${existing.id}` : "/meds");
  };

  return (
    <form
      className="px-5 pt-3 pb-8 space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <label className="flex flex-col gap-2">
        <span className="text-label text-muted-foreground">{t("name")}</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="off" placeholder={t("namePlaceholder")} className={inputClass} />
      </label>

      <Group label={t("form")}>
        <div className="flex flex-wrap gap-2">
          <RadioChips label={t("form")} value={form} onChange={(f) => setForm(f === form ? null : f)} options={shownForms.map((f) => ({ value: f, label: medFormLabel(f) }))} />
          {!allForms && (
            <button type="button" onClick={() => setAllForms(true)} className="min-h-touch-min px-4 flex items-center gap-1.5 rounded-full border-[1.5px] border-dashed border-dashed-line bg-card text-body">
              {t("more")} <ChevronDown size={16} strokeWidth={2} aria-hidden="true" />
            </button>
          )}
        </div>
      </Group>

      <Group label={t("dose")}>
        <div className="flex gap-2">
          <label className="flex-1">
            <span className="sr-only">{t("doseAmount")}</span>
            <input inputMode="decimal" value={dose} onChange={(e) => setDose(e.target.value.replace(/[^0-9.]/g, ""))} placeholder={t("amount")} className={inputClass} />
          </label>
          <label>
            <span className="sr-only">{t("unit")}</span>
            <select value={unit} onChange={(e) => setUnit(e.target.value)} className="h-button rounded-lg border border-input bg-card px-3 text-[16px] font-extrabold">
              {DOSE_UNITS.map((u) => <option key={u} value={u}>{doseUnitName(u)}</option>)}
            </select>
          </label>
        </div>
      </Group>

      <Notice tone="info">{t("neverSuggest")}</Notice>

      <Group label={t("howGiven")}>
        <RadioChips label={t("howGivenLabel")} variant="block" columns={2} value={kind} onChange={setKind} options={[{ value: "scheduled", label: t("onSchedule") }, { value: "prn", label: t("asNeeded") }]} />
      </Group>

      {kind === "scheduled" && (
        <>
          <Group label={t("when")}>
            <div className="flex flex-wrap gap-2">
              {[...times].sort().map((tm) => (
                <span key={tm} className="min-h-touch-min pl-4 pr-1.5 flex items-center gap-1 rounded-full bg-profile text-on-profile text-body font-extrabold">
                  {to12h(tm)}
                  <button type="button" aria-label={t("removeTime", { time: to12h(tm) })} onClick={() => setTimes((xs) => xs.filter((x) => x !== tm))} className="w-8 h-8 rounded-full flex items-center justify-center">
                    <X size={16} strokeWidth={2.5} aria-hidden="true" />
                  </button>
                </span>
              ))}
              <label className="min-h-touch-min px-3 flex items-center gap-1.5 rounded-full border-[1.5px] border-dashed border-dashed-line bg-card text-body">
                <Plus size={16} strokeWidth={2} aria-hidden="true" />
                <span className="sr-only">{t("addTime")}</span>
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  onBlur={() => {
                    if (newTime && !times.includes(newTime)) setTimes((xs) => [...xs, newTime]);
                    setNewTime("");
                  }}
                  className="bg-transparent text-[16px] font-bold"
                  aria-label={t("addTime")}
                />
              </label>
            </div>
          </Group>
          <Group label={t("days")}>
            <div className="grid grid-cols-7 gap-1.5">
              {days7.map((full, i) => {
                const on = days.includes(i);
                return (
                  <button
                    key={full}
                    type="button"
                    aria-pressed={on}
                    aria-label={full}
                    onClick={() => setDays((xs) => (on ? xs.filter((x) => x !== i) : [...xs, i]))}
                    className={`h-touch rounded-full border text-body font-extrabold ${on ? "bg-profile border-profile text-on-profile" : "bg-secondary border-border"}`}
                  >
                    {full.charAt(0)}
                  </button>
                );
              })}
            </div>
          </Group>
        </>
      )}

      {kind === "prn" && (
        <Group label={t("minHours")} hint={t("minHoursHint")}>
          <Stepper
            display={minHours === null ? t("notSet") : t("hours", { count: minHours })}
            caption={minHours === null ? t("warnsWithin") : t("warnSooner")}
            onDecrease={() => setMinHours((h) => (h === null || h <= 1 ? null : h - 1))}
            onIncrease={() => setMinHours((h) => Math.min(72, (h ?? 0) + 1))}
            canDecrease={minHours !== null}
            decreaseLabel={t("fewerHours")}
            increaseLabel={t("moreHours")}
          />
        </Group>
      )}

      <div className="rounded-lg bg-secondary">
        <button type="button" aria-expanded={more} onClick={() => setMore((v) => !v)} className="w-full min-h-button flex items-center gap-2.5 px-4 text-left">
          <span className="flex-1 flex flex-col">
            <span className="text-body font-extrabold">{t("moreDetails")}</span>
            {!more && <span className="text-caption text-muted-foreground">{kind === "scheduled" ? t("moreDetailsHintScheduled") : t("moreDetailsHint")}</span>}
          </span>
          <ChevronDown size={20} strokeWidth={2} aria-hidden="true" className={more ? "rotate-180" : ""} />
        </button>
        {more && (
          <div className="px-4 pb-4 space-y-3">
            {[
              [t("strength"), strength, setStrength, t("strengthPlaceholder")],
              [t("purpose"), purpose, setPurpose, t("purposePlaceholder")],
              [t("prescriber"), prescriber, setPrescriber, t("prescriberPlaceholder")],
              [t("instructions"), instructions, setInstructions, t("instructionsPlaceholder")],
            ].map(([label, value, set, placeholder]) => (
              <label key={label as string} className="flex flex-col gap-1.5">
                <span className="text-label text-muted-foreground">{label as string}</span>
                <input value={value as string} onChange={(e) => (set as (v: string) => void)(e.target.value)} placeholder={placeholder as string} className={inputClass} />
              </label>
            ))}
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-label text-muted-foreground">{t("startDate")}</span>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-label text-muted-foreground">{t("endDate")}</span>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
              </label>
            </div>
            {kind === "scheduled" && (
              <Group label={t("doseWindow")} hint={t("doseWindowHint")}>
                <Stepper
                  display={t("windowValue", { count: windowMin })}
                  onDecrease={() => setWindowMin((w) => Math.max(15, w - 15))}
                  onIncrease={() => setWindowMin((w) => Math.min(240, w + 15))}
                  decreaseLabel={t("shorterWindow")}
                  increaseLabel={t("longerWindow")}
                />
              </Group>
            )}
            {kind === "scheduled" && (
              <Group label={t("minHours")} hint={tc("optional")}>
                <Stepper
                  display={minHours === null ? t("notSet") : t("hours", { count: minHours })}
                  onDecrease={() => setMinHours((h) => (h === null || h <= 1 ? null : h - 1))}
                  onIncrease={() => setMinHours((h) => Math.min(72, (h ?? 0) + 1))}
                  canDecrease={minHours !== null}
                  decreaseLabel={t("fewerHours")}
                  increaseLabel={t("moreHours")}
                />
              </Group>
            )}
          </div>
        )}
      </div>

      {(doseChanged || scheduleChanged) && (
        <label className="flex flex-col gap-1.5 p-4 rounded-card bg-card shadow-card">
          <span className="text-body font-extrabold">{t("effectiveFrom")}</span>
          <span className="text-caption text-muted-foreground">{doseChanged ? t("effectiveDose") : t("effectiveSchedule")}</span>
          <input type="date" value={effectiveFrom} max={ymd(new Date())} onChange={(e) => setEffectiveFrom(e.target.value)} className={inputClass} />
        </label>
      )}

      {error && <p role="alert" className="text-label font-bold text-destructive">{error}</p>}

      <button type="submit" disabled={saving} className="w-full h-button rounded-full bg-primary text-primary-foreground text-body-lg disabled:opacity-60">
        {saving ? t("saving") : t("save")}
      </button>
      {existing?.active && (
        <button type="button" disabled={saving} onClick={() => void save(false)} className="w-full h-button rounded-full border-[1.5px] border-border-strong bg-card text-body-lg text-destructive">
          {t("stop")}
        </button>
      )}
    </form>
  );
}
