"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, Download, FileJson, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useHousehold, type ProfileSummary } from "@/lib/context/household-provider";
import { useRepo } from "@/lib/data/repo-context";
import { updateProfile } from "@/lib/actions/settings";
import { downloadText, entriesToCsv } from "@/lib/reports/csv";
import { ymd } from "@/lib/dates";

export default function DataPage() {
  const { profiles, archivedProfiles, householdName, householdSettings, currentMember } = useHousehold();
  const repo = useRepo();
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<ProfileSummary | null>(null);
  const isAdmin = currentMember.role === "admin";
  const everyone = [...profiles, ...archivedProfiles];
  const nameOf = (id: string) => everyone.find((p) => p.id === id)?.name ?? "";

  /** SET-06: all profiles, entries (including deleted), medications, change history and appointments. */
  const exportAll = () =>
    startTransition(async () => {
      const [entries, deleted] = await Promise.all([repo.listEntries({}), repo.listEntries({ deleted: "only" })]);
      const perProfile = await Promise.all(
        everyone.map(async (p) => ({
          medications: await repo.listMedications(p.id),
          medication_changes: await repo.listMedicationChanges(p.id),
          appointments: await repo.listAppointments(p.id),
        })),
      );
      const stamp = ymd(new Date());
      const json = {
        exported_at: new Date().toISOString(),
        household: { name: householdName, settings: householdSettings },
        profiles: everyone.map((p) => ({
          id: p.id, name: p.name, color: p.color, dob: p.dob, care_stage: p.careStage, toileting: p.toileting,
          feeding_methods: p.feedingMethods, enabled_modules: p.enabledModules, settings: p.settings, care_card: p.careCard,
          archived: archivedProfiles.some((a) => a.id === p.id),
        })),
        entries: [...entries, ...deleted].map((e) => {
          const copy: Record<string, unknown> = { ...e };
          delete copy._sync;
          return copy;
        }),
        medications: perProfile.flatMap((x) => x.medications),
        medication_changes: perProfile.flatMap((x) => x.medication_changes),
        appointments: perProfile.flatMap((x) => x.appointments),
      };
      downloadText(`behavior-logger-export-${stamp}.json`, JSON.stringify(json, null, 2), "application/json;charset=utf-8");
      setTimeout(() => downloadText(`behavior-logger-entries-${stamp}.csv`, entriesToCsv(entries, nameOf)), 400);
      setMessage(`Exported ${entries.length} entries for ${everyone.length} ${everyone.length === 1 ? "person" : "people"}.`);
    });

  return (
    <>
      <PageHeader title="Your data" backHref="/more" backLabel="Back to More" showDot={false} />
      <div className="px-5 pt-3 pb-8 space-y-6">
        <section aria-labelledby="export-h" className="space-y-2.5">
          <h2 id="export-h" className="font-display text-title-5">Export everything</h2>
          <p className="text-label font-normal text-foreground-2">
            A JSON file with every profile, entry, medication and change, plus a CSV of all entries. Your family owns this data.
          </p>
          <button type="button" disabled={busy} onClick={exportAll} className="w-full h-button flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground text-body-lg disabled:opacity-60">
            <FileJson size={20} strokeWidth={2} aria-hidden="true" /> {busy ? "Preparing…" : "Export JSON and CSV"}
          </button>
          <p className="flex items-center gap-1.5 text-caption text-muted-foreground"><Download size={14} strokeWidth={2} aria-hidden="true" /> Doctor-ready reports are under Reports.</p>
        </section>

        {isAdmin && (
          <section aria-labelledby="archive-h" className="space-y-2.5">
            <h2 id="archive-h" className="font-display text-title-5">Archive a profile</h2>
            <p className="text-label font-normal text-foreground-2">Archived profiles leave the switcher. Their data stays in exports, and you can restore them from More.</p>
            <div className="rounded-card bg-card shadow-card divide-y divide-divider">
              {profiles.map((p) => (
                <div key={p.id} className="min-h-[60px] flex items-center gap-3 px-3.5 py-2">
                  <span className="flex-1 text-body-md">{p.name}</span>
                  <button type="button" disabled={profiles.length <= 1} onClick={() => setArchiving(p)} className="min-h-touch-min flex items-center gap-1.5 px-4 rounded-full border-[1.5px] border-border-strong text-label font-extrabold disabled:opacity-40">
                    <Archive size={16} strokeWidth={2} aria-hidden="true" /> Archive
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="delete-h" className="space-y-2.5">
          <h2 id="delete-h" className="font-display text-title-5">Delete permanently</h2>
          <div className="flex items-start gap-2.5 p-3.5 rounded-[18px] bg-secondary text-foreground-2">
            <Trash2 size={18} strokeWidth={2} className="flex-none mt-0.5" aria-hidden="true" />
            <p className="text-label font-normal">
              Permanently deleting a profile or the whole account isn&rsquo;t switched on yet. Export your data first; until then, archiving hides a profile everywhere.
            </p>
          </div>
        </section>

        {message && <p role="status" className="text-label font-bold text-foreground-2 text-center">{message}</p>}
      </div>

      {archiving && (
        <ConfirmDialog
          title={`Archive ${archiving.name}?`}
          body={`${archiving.name} leaves the switcher for every caregiver. Nothing is deleted, and an admin can restore the profile from More.`}
          cancelLabel="Keep"
          confirmLabel="Archive"
          onCancel={() => setArchiving(null)}
          onConfirm={() => {
            const p = archiving;
            setArchiving(null);
            startTransition(async () => {
              const r = await updateProfile(p.id, { archived: true });
              setMessage("error" in r ? r.error : `${p.name} archived.`);
              router.refresh();
            });
          }}
        />
      )}
    </>
  );
}
