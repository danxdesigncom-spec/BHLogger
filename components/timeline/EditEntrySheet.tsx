"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Flag, Lock, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { MODULE_CIRCLE, MODULE_ICONS, type ModuleFormContext, type ModuleType } from "@/components/log/LogSheet";
import { Group, RadioChips } from "@/components/log/controls";
import { BathroomSheet } from "@/components/log/modules/BathroomSheet";
import { EatingSheet } from "@/components/log/modules/EatingSheet";
import { ActivitySheet } from "@/components/log/modules/ActivitySheet";
import { MoodSheet } from "@/components/log/modules/MoodSheet";
import { DoseForm } from "@/components/meds/GiveDoseSheet";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AddToQuickTaps } from "./AddToQuickTaps";
import { useHousehold } from "@/lib/context/household-provider";
import { useMedications, useRevisions } from "@/lib/data/hooks";
import { useRepo } from "@/lib/data/repo-context";
import type { LocalEntry } from "@/lib/data/types";
import { useOptionLabels } from "@/lib/data/useOptionSet";
import { entryDetail, entryTitle, formatClock, type SummaryContext } from "@/lib/entries/summary";
import { bathroomTileLabel, humanize } from "@/lib/options";
import { describeRevision } from "@/lib/timeline";
import { formatDateTime } from "@/lib/prefs";

function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v).filter((k) => (v as Record<string, unknown>)[k] !== undefined).sort().map((k) => `${k}:${stable((v as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(v ?? null);
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function EditEntrySheet({
  entry, onClose, onDeleted,
}: {
  entry: LocalEntry;
  onClose: () => void;
  onDeleted: (entry: LocalEntry) => void;
}) {
  const { profiles, currentMember, members, householdSettings } = useHousehold();
  const repo = useRepo();
  const qc = useQueryClient();
  const profile = profiles.find((p) => p.id === entry.profile_id);
  const meds = useMedications(entry.profile_id);
  const revisions = useRevisions(entry.id);
  const optionLabel = useOptionLabels(entry.profile_id);
  const titleRef = useRef<HTMLHeadingElement>(null);

  const canEdit = currentMember.role === "admin" || (currentMember.role === "caregiver" && entry.logged_by === currentMember.userId);
  const mod = (["bathroom", "eating", "activity", "mood", "medication"].includes(entry.type) ? entry.type : null) as ModuleType | null;

  const [profileId, setProfileId] = useState(entry.profile_id);
  const [when, setWhen] = useState(toLocalInput(entry.occurred_at));
  const [data, setData] = useState<Record<string, unknown>>((entry.data ?? {}) as Record<string, unknown>);
  const [note, setNote] = useState(entry.note ?? "");
  const [flagged, setFlagged] = useState(entry.flagged_for_doctor);
  const [detailsEl, setDetailsEl] = useState<HTMLDivElement | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => titleRef.current?.focus(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSetData = useCallback((d: Record<string, unknown>) => setData(d), []);
  const ctx: ModuleFormContext = { setData: handleSetData, setFlagged, flagged, detailsEl };

  const t = useTranslations();
  const te = (k: string, v?: Record<string, string | number>) => t(`editEntry.${k}`, v);
  const stage = profile?.careStage ?? "child";
  const toileting = profile?.toileting ?? "toilet";
  const summaryCtx: SummaryContext = {
    careStage: stage, toileting, volumeUnit: householdSettings.volume_unit,
    medicationName: (id) => meds.data?.find((m) => m.id === id)?.name,
    optionLabel,
  };
  const med = entry.type === "medication" ? meds.data?.find((m) => m.id === (entry.data as { medication_id?: string }).medication_id) : undefined;
  const heading =
    entry.type === "medication" ? te("medDose", { name: med?.name ?? t("modules.medication") })
    : entry.type === "bathroom" ? te("entry", { name: bathroomTileLabel(stage, toileting) })
    : entry.type === "eating" && stage === "baby" ? te("entry", { name: t("modules.feeding") })
    : te("entry", { name: t.has(`modules.${entry.type}`) ? t(`modules.${entry.type}`) : humanize(entry.type) });
  const userName = (id: string | null) => members.find((m) => m.userId === id)?.displayName ?? te("someone");

  const save = async () => {
    const occurredAt = new Date(when);
    if (occurredAt.getTime() > Date.now() + 60_000) return setError(te("futureTime"));
    setSaving(true);
    setError(null);
    const patch = {
      ...(occurredAt.toISOString().slice(0, 16) !== new Date(entry.occurred_at).toISOString().slice(0, 16) ? { occurredAt: occurredAt.toISOString() } : {}),
      ...(profileId !== entry.profile_id ? { profileId } : {}),
      ...(stable(data) !== stable(entry.data) ? { data } : {}),
      ...(note.trim() !== (entry.note ?? "") ? { note: note.trim() || null } : {}),
      ...(flagged !== entry.flagged_for_doctor ? { flaggedForDoctor: flagged } : {}),
    };
    if (!Object.keys(patch).length) {
      onClose();
      return;
    }
    const result = await repo.updateEntry(entry.id, patch);
    setSaving(false);
    if ("error" in result) return setError(result.error);
    for (const key of ["entries", "latest-entry", "revisions"]) await qc.invalidateQueries({ queryKey: [key] });
    onClose();
  };

  const remove = async () => {
    setConfirmDelete(false);
    const result = await repo.deleteEntry(entry.id);
    if ("error" in result) return setError(result.error);
    for (const key of ["entries", "latest-entry"]) await qc.invalidateQueries({ queryKey: [key] });
    onDeleted(entry);
  };

  return (
    <>
      <div aria-hidden="true" className="fixed inset-0 z-40 bg-[var(--overlay)] animate-fade-in" onClick={onClose} />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-title"
        className="fixed left-0 right-0 bottom-0 z-50 flex flex-col rounded-t-sheet bg-card max-h-[calc(100dvh-56px)] animate-sheet-in md:left-1/2 md:right-auto md:bottom-auto md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[480px] md:max-h-[85dvh] md:rounded-sheet"
      >
        <div aria-hidden="true" className="w-10 h-[5px] mt-2.5 flex-none self-center rounded-full bg-grabber" />
        <header className="flex-none flex items-center gap-3 px-5 pt-3 pb-1">
          {mod && (
            <span className={`w-12 h-12 flex-none rounded-full flex items-center justify-center ${MODULE_CIRCLE[mod]}`}>{MODULE_ICONS[mod]}</span>
          )}
          <div className="flex-1 min-w-0">
            <h2 id="edit-title" ref={titleRef} tabIndex={-1} className="font-display text-title-1 outline-none">{heading}</h2>
            <p className="text-label font-bold text-muted-foreground">
              {te("loggedBy", { name: entry.logged_by_name, time: formatClock(entry.created_at) })}
            </p>
          </div>
          <button type="button" aria-label={t("common.close")} onClick={onClose} className="w-11 h-11 flex-none rounded-full bg-secondary flex items-center justify-center">
            <X size={20} strokeWidth={2} aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 pt-3 pb-4 space-y-4">
          {!canEdit ? (
            <>
              <div className="flex items-start gap-2.5 p-3.5 rounded-[18px] bg-secondary text-foreground-2">
                <Lock size={18} strokeWidth={2} className="flex-none mt-0.5" aria-hidden="true" />
                <span className="text-label font-normal">
                  {currentMember.role === "viewer"
                    ? te("viewerNote")
                    : te("ownerNote", { name: entry.logged_by_name })}
                </span>
              </div>
              <dl className="rounded-card bg-secondary divide-y divide-divider">
                {[
                  [te("person"), profile?.name ?? ""],
                  [te("when"), formatDateTime(entry.occurred_at)],
                  [te("what"), entryTitle(entry, summaryCtx)],
                  [te("details"), entryDetail(entry, summaryCtx) || "—"],
                  [te("note"), entry.note || "—"],
                  [te("forDoctor"), entry.flagged_for_doctor ? t("common.yes") : t("common.no")],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 px-4 py-3">
                    <dt className="text-label text-muted-foreground">{k}</dt>
                    <dd className="text-body text-right">{v}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : (
            <>
              {profiles.length > 1 && (
                <Group label={te("person")}>
                  <RadioChips label={te("person")} value={profileId} onChange={setProfileId} options={profiles.map((p) => ({ value: p.id, label: p.name }))} />
                </Group>
              )}
              <label className="flex flex-col gap-2">
                <span className="text-label text-muted-foreground">{te("when")}</span>
                <input
                  type="datetime-local"
                  value={when}
                  max={toLocalInput(new Date().toISOString())}
                  onChange={(e) => setWhen(e.target.value)}
                  className="h-button rounded-lg border border-input bg-card px-4 text-[16px] font-bold"
                />
              </label>

              {entry.type === "bathroom" && <BathroomSheet ctx={ctx} initial={entry.data as Record<string, unknown>} />}
              {entry.type === "eating" && <EatingSheet ctx={ctx} initial={entry.data as Record<string, unknown>} />}
              {entry.type === "activity" && <ActivitySheet ctx={ctx} initial={entry.data as Record<string, unknown>} />}
              {entry.type === "mood" && <MoodSheet ctx={ctx} initial={entry.data as Record<string, unknown>} />}
              {entry.type === "medication" && med && (
                <DoseForm
                  ctx={ctx}
                  med={med}
                  slot={(entry.data as { scheduled_for?: string | null }).scheduled_for ? new Date((entry.data as { scheduled_for: string }).scheduled_for) : null}
                  lastHint={null}
                  initial={entry.data as Record<string, unknown>}
                />
              )}
              <div ref={setDetailsEl} className="space-y-4 empty:hidden" />

              <label className="flex flex-col gap-2">
                <span className="text-label text-muted-foreground">{te("note")}</span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder={t("common.optional")}
                  className="rounded-lg border border-input bg-card px-4 py-3 text-[16px] font-bold resize-none"
                />
              </label>
              <label className="flex items-center justify-between gap-3 min-h-touch-min">
                <span className="flex flex-col">
                  <span className="flex items-center gap-1.5 text-body font-extrabold">
                    <Flag size={16} strokeWidth={2} aria-hidden="true" /> {t("log.flagForDoctor")}
                  </span>
                  <span className="text-caption text-muted-foreground">{t("log.flagHint")}</span>
                </span>
                <input type="checkbox" role="switch" checked={flagged} onChange={(e) => setFlagged(e.target.checked)} className="switch" />
              </label>
            </>
          )}

          {currentMember.role !== "viewer" && <AddToQuickTaps entry={entry} ctx={summaryCtx} />}

          <section aria-labelledby="history-h" className="space-y-2">
            <h3 id="history-h" className="font-sans text-label text-muted-foreground">{te("history")}</h3>
            <ol className="space-y-1.5 text-caption text-foreground-2">
              {(revisions.data ?? []).map((r) => {
                const changes = describeRevision(r.before as Record<string, unknown>, r.after as Record<string, unknown>, stage, (id) => profiles.find((p) => p.id === id)?.name ?? t("timeline.revision.anotherPerson"));
                return (
                  <li key={r.id}>
                    <span className="font-extrabold">{formatClock(r.changed_at)}</span> · {te("revision", { who: userName(r.changed_by), changes: changes.join(", ") || t("timeline.revision.edited") })}
                  </li>
                );
              })}
              <li>
                <span className="font-extrabold">{formatClock(entry.created_at)}</span> · {te("loggedThis", { name: entry.logged_by_name })}
              </li>
            </ol>
          </section>
        </div>

        {error && <p role="alert" className="flex-none px-5 pb-1 text-caption font-bold text-destructive">{error}</p>}

        {canEdit && (
          <footer className="flex-none flex items-center gap-2.5 px-5 pt-3 border-t border-divider" style={{ paddingBottom: "calc(28px + env(safe-area-inset-bottom, 0px))" }}>
            <button type="button" onClick={() => setConfirmDelete(true)} className="h-button px-5 rounded-full border-[1.5px] border-border-strong bg-card text-body-md text-destructive">
              {t("common.delete")}
            </button>
            <button type="button" onClick={() => void save()} disabled={saving} className="flex-1 h-button rounded-full bg-primary text-primary-foreground text-body-lg disabled:opacity-60">
              {saving ? te("saving") : te("saveChanges")}
            </button>
          </footer>
        )}
      </section>

      {confirmDelete && (
        <ConfirmDialog
          title={te("deleteTitle")}
          body={te("deleteBody")}
          cancelLabel={te("keepIt")}
          confirmLabel={t("common.delete")}
          destructive
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => void remove()}
        />
      )}
    </>
  );
}
