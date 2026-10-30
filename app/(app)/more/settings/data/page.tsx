"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, Download, FileJson, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useHousehold, type ProfileSummary } from "@/lib/context/household-provider";
import { useRepo } from "@/lib/data/repo-context";
import { updateProfile } from "@/lib/actions/settings";
import { deleteAccount, deleteProfile } from "@/lib/actions/deletion";
import { downloadText, entriesToCsv } from "@/lib/reports/csv";
import { ymd } from "@/lib/dates";
import { dateLocale } from "@/lib/prefs";
import { accountDeletion } from "@/lib/account-deletion";
import { usePendingCount } from "@/lib/data/hooks";
import { clearLocalData } from "@/lib/data/outbox";
import { clearDemoData } from "@/lib/data/demo-repo";
import { forgetReportItems } from "@/lib/report-items";
import { forgetSavedReport } from "@/lib/reports/templates";
import { clearTimersFor } from "@/lib/timers";

export default function DataPage() {
  const { mode, profiles, archivedProfiles, members, householdName, householdSettings, currentMember, otherHouseholds } = useHousehold();
  const repo = useRepo();
  const router = useRouter();
  const t = useTranslations("settings");
  const [busy, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<ProfileSummary | null>(null);
  const [deleting, setDeleting] = useState<{ profile: ProfileSummary; entries: number } | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const pending = usePendingCount();
  const isAdmin = currentMember.role === "admin";
  const everyone = [...profiles, ...archivedProfiles];
  const nameOf = (id: string) => everyone.find((p) => p.id === id)?.name ?? "";
  const list = (names: string[]) => new Intl.ListFormat(dateLocale(), { type: "conjunction" }).format(names);
  const people = list(everyone.map((p) => p.name));
  // SET-07 covers every household this person belongs to, not just the one on screen.
  const account = accountDeletion(mode, [
    { name: householdName, memberCount: members.length, adminCount: members.filter((m) => m.role === "admin").length, myRole: currentMember.role },
    ...otherHouseholds.map((h) => ({ name: h.name, memberCount: h.memberCount, adminCount: h.adminCount, myRole: h.role })),
  ]);
  const accountText =
    account.kind === "demo"
      ? t("data.account.demo")
      : account.kind === "last_admin"
        ? t("data.account.last_admin", { household: account.household })
        : !otherHouseholds.length
          ? account.deletes.length
            ? t("data.account.sole", { household: householdName, people })
            : t("data.account.leave", { household: householdName })
          : [
              account.deletes.length ? t("data.account.multiDeletes", { households: list(account.deletes), count: account.deletes.length }) : "",
              account.leaves.length ? t("data.account.multiLeaves", { households: list(account.leaves) }) : "",
              t("data.account.multiSignIn"),
            ].filter(Boolean).join(" ");

  /** SET-06: all profiles, entries (including deleted), medications, change history and appointments. */
  const exportAll = () =>
    startTransition(async () => {
      const known = new Set(everyone.map((p) => p.id));
      const [entries, deleted] = (await Promise.all([repo.listEntries({}), repo.listEntries({ deleted: "only" })])).map((rows) => rows.filter((e) => known.has(e.profile_id)));
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
      setMessage(t("data.exported", { entries: entries.length, people: everyone.length }));
    });

  return (
    <>
      <PageHeader title={t("data.title")} backHref="/more" backLabel={t("backToMore")} showDot={false} />
      <div className="px-5 pt-3 pb-8 space-y-6">
        <section aria-labelledby="export-h" className="space-y-2.5">
          <h2 id="export-h" className="font-display text-title-5">{t("data.exportTitle")}</h2>
          <p className="text-label font-normal text-foreground-2">
            {t("data.exportBody")}
            {otherHouseholds.length > 0 && ` ${t("data.exportHousehold", { household: householdName })}`}
          </p>
          <button type="button" disabled={busy} onClick={exportAll} className="w-full h-button flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground text-body-lg disabled:opacity-60">
            <FileJson size={20} strokeWidth={2} aria-hidden="true" /> {busy ? t("data.preparing") : t("data.exportButton")}
          </button>
          <p className="flex items-center gap-1.5 text-caption text-muted-foreground"><Download size={14} strokeWidth={2} aria-hidden="true" /> {t("data.reportsHint")}</p>
        </section>

        {isAdmin && (
          <section aria-labelledby="archive-h" className="space-y-2.5">
            <h2 id="archive-h" className="font-display text-title-5">{t("data.archiveTitle")}</h2>
            <p className="text-label font-normal text-foreground-2">{t("data.archiveBody")}</p>
            <div className="rounded-card bg-card shadow-card divide-y divide-divider">
              {profiles.map((p) => (
                <div key={p.id} className="min-h-[60px] flex items-center gap-3 px-3.5 py-2">
                  <span className="flex-1 text-body-md">{p.name}</span>
                  <button type="button" disabled={profiles.length <= 1} onClick={() => setArchiving(p)} className="min-h-touch-min flex items-center gap-1.5 px-4 rounded-full border-[1.5px] border-border-strong text-label font-extrabold disabled:opacity-40">
                    <Archive size={16} strokeWidth={2} aria-hidden="true" /> {t("data.archive")}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="delete-h" className="space-y-4">
          <h2 id="delete-h" className="font-display text-title-5">{t("data.deleteTitle")}</h2>
          <div className="flex items-start gap-2.5 p-3.5 rounded-[18px] bg-secondary text-foreground-2">
            <Trash2 size={18} strokeWidth={2} className="flex-none mt-0.5" aria-hidden="true" />
            <p className="text-label font-normal">{t("data.deleteBody")}</p>
          </div>

          {isAdmin && (
            <section aria-labelledby="delete-people-h" className="space-y-2">
              <h3 id="delete-people-h" className="text-label text-muted-foreground">{t("data.deletePeople")}</h3>
              <div className="rounded-card bg-card shadow-card divide-y divide-divider">
                {everyone.map((p) => (
                  <div key={p.id} className="min-h-[60px] flex items-center gap-3 px-3.5 py-2">
                    <span className="flex-1 min-w-0">
                      <span className="block text-body-md">{p.name}</span>
                      {archivedProfiles.some((a) => a.id === p.id) && <span className="block text-caption text-muted-foreground">{t("data.archivedTag")}</span>}
                    </span>
                    <button
                      type="button"
                      disabled={busy || everyone.length <= 1}
                      aria-label={t("data.deletePersonLabel", { name: p.name })}
                      onClick={async () => setDeleting({ profile: p, entries: (await repo.listEntries({ profileId: p.id })).length })}
                      className="min-h-touch-min flex items-center gap-1.5 px-4 rounded-full border-[1.5px] border-destructive-border text-destructive text-label font-extrabold disabled:opacity-40"
                    >
                      <Trash2 size={16} strokeWidth={2} aria-hidden="true" /> {t("data.deletePerson")}
                    </button>
                  </div>
                ))}
              </div>
              {everyone.length <= 1 && <p className="text-caption text-muted-foreground">{t("data.lastPerson", { name: everyone[0]?.name ?? "" })}</p>}
            </section>
          )}

          <section aria-labelledby="delete-account-h" className="space-y-2">
            <h3 id="delete-account-h" className="text-label text-muted-foreground">{t("data.deleteAccountTitle")}</h3>
            <p id="delete-account-what" className="text-label font-normal text-foreground-2">
              {accountText}
            </p>
            <button
              type="button"
              disabled={busy || account.kind === "last_admin"}
              aria-describedby="delete-account-what"
              onClick={() => setDeletingAccount(true)}
              className="w-full h-button flex items-center justify-center gap-2 rounded-full border-[1.5px] border-destructive-border bg-card text-destructive text-body-lg disabled:opacity-40"
            >
              <Trash2 size={20} strokeWidth={2} aria-hidden="true" /> {mode === "demo" ? t("data.deleteDemo") : t("data.deleteAccount")}
            </button>
          </section>
        </section>

        {message && <p role="status" className="text-label font-bold text-foreground-2 text-center">{message}</p>}
      </div>

      {deleting && (
        <ConfirmDialog
          title={t("data.deletePersonTitle", { name: deleting.profile.name })}
          body={t("data.deletePersonBody", { name: deleting.profile.name, count: deleting.entries })}
          acknowledge={t("data.understand")}
          cancelLabel={t("data.keepPerson", { name: deleting.profile.name })}
          confirmLabel={t("data.deletePersonConfirm", { name: deleting.profile.name })}
          destructive
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            const p = deleting.profile;
            setDeleting(null);
            startTransition(async () => {
              const r = await deleteProfile(p.id);
              if ("error" in r) return setMessage(r.error);
              // Nothing about the person stays on this phone either.
              await repo.forgetProfile(p.id);
              forgetReportItems(p.id);
              forgetSavedReport(p.id);
              await clearTimersFor(p.id);
              setMessage(t("data.deletedPerson", { name: p.name }));
              router.refresh();
            });
          }}
        />
      )}

      {deletingAccount && (
        <ConfirmDialog
          title={mode === "demo" ? t("data.deleteDemoTitle") : t("data.deleteAccountConfirmTitle")}
          body={[
            accountText,
            account.kind !== "demo" && (pending.data ?? 0) > 0 ? t("data.accountUnsynced", { count: pending.data ?? 0 }) : "",
          ].filter(Boolean).join(" ")}
          acknowledge={mode === "demo" ? undefined : t("data.understand")}
          cancelLabel={t("data.keepAccount")}
          confirmLabel={mode === "demo" ? t("data.deleteDemo") : t("data.deleteAccount")}
          destructive
          onCancel={() => setDeletingAccount(false)}
          onConfirm={() => {
            setDeletingAccount(false);
            startTransition(async () => {
              const r = await deleteAccount();
              if ("error" in r) return setMessage(r.error);
              if (mode === "demo") await clearDemoData();
              else await clearLocalData();
              window.location.assign(mode === "demo" ? "/auth/login" : "/auth/login?deleted=1");
            });
          }}
        />
      )}

      {archiving && (
        <ConfirmDialog
          title={t("data.confirmTitle", { name: archiving.name })}
          body={t("data.confirmBody", { name: archiving.name })}
          cancelLabel={t("data.keep")}
          confirmLabel={t("data.archive")}
          onCancel={() => setArchiving(null)}
          onConfirm={() => {
            const p = archiving;
            setArchiving(null);
            startTransition(async () => {
              const r = await updateProfile(p.id, { archived: true });
              setMessage("error" in r ? r.error : t("data.archivedMessage", { name: p.name }));
              router.refresh();
            });
          }}
        />
      )}
    </>
  );
}
