"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2, Check, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { saveMember, removeMemberAction } from "./actions";
import type { ProfileColor } from "@/lib/supabase/types";
import { formatTime } from "@/lib/prefs";
import { longDate } from "@/lib/dates";
import { roleLabel } from "@/lib/options";
import { t as translate } from "@/lib/i18n";

type Role = "admin" | "caregiver" | "viewer";

interface Profile {
  id: string;
  name: string;
  color: ProfileColor;
}

interface Member {
  id: string;
  displayName: string;
  initials: string;
  role: Role;
  joinedAt: string;
  lastLoggedAt: string | null;
  restrictedProfileIds: string[];
}

interface Props {
  householdId: string;
  member: Member;
  profiles: Profile[];
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return translate("common.minAgo", { count: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return translate("caregivers.todayAt", { time: formatTime(iso) });
  return longDate(new Date(iso));
}

export function ManageCaregiverClient({ householdId, member, profiles }: Props) {
  const router = useRouter();
  const t = useTranslations("caregivers");
  const tc = useTranslations("common");
  const [role, setRole] = useState<Role>(member.role);
  const [selectedProfiles, setSelectedProfiles] = useState<Set<string>>(
    member.restrictedProfileIds.length > 0
      ? new Set(member.restrictedProfileIds)
      : new Set(profiles.map((p) => p.id)),
  );
  const [confirmRemove, setConfirmRemove] = useState(false);

  const [saveState, saveAction, savePending] = useActionState(saveMember, null);
  const [removeState, removeAction, removePending] = useActionState(removeMemberAction, null);

  const toggleProfile = (id: string) =>
    setSelectedProfiles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });

  const saveError = saveState && 'error' in saveState ? saveState.error : undefined;
  const removeError = removeState && 'error' in removeState ? removeState.error : undefined;

  // Compute profile IDs to persist: empty = full access (all selected)
  const allSelected = selectedProfiles.size === profiles.length;
  const profileIdsToSave = allSelected ? [] : Array.from(selectedProfiles);

  return (
    <div className="flex flex-col min-h-dvh">
      {/* Header */}
      <header className="flex items-center gap-3 px-5 pt-5 pb-1">
        <button
          type="button"
          aria-label={tc("back")}
          onClick={() => router.back()}
          className="w-11 h-11 flex-none rounded-full bg-card shadow-raised flex items-center justify-center"
        >
          <ArrowLeft size={22} strokeWidth={2} aria-hidden="true" />
        </button>
      </header>

      {/* Avatar + name */}
      <div className="flex items-center gap-4 px-5 pt-4 pb-0">
        <span
          aria-hidden="true"
          className="w-[72px] h-[72px] flex-none rounded-full bg-secondary text-foreground flex items-center justify-center font-display text-display-2"
        >
          {member.initials}
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-display-2">{member.displayName}</h1>
          <span className="text-label font-normal text-muted-foreground">
            {t("joined", { date: longDate(new Date(member.joinedAt)) })} ·{" "}
            {member.lastLoggedAt ? t("lastLogged", { when: formatRelative(member.lastLoggedAt) }) : t("notLogged")}
          </span>
        </div>
      </div>

      <form action={saveAction} className="flex flex-col gap-5 px-5 pt-6 pb-4 flex-1">
        <input type="hidden" name="memberId" value={member.id} />
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="role" value={role} />
        <input type="hidden" name="profileIds" value={JSON.stringify(profileIdsToSave)} />

        {(saveError ?? removeError) && (
          <p role="alert" className="rounded-lg border border-flag-border bg-flag px-4 py-3 text-label font-bold text-flag-ink">
            {saveError === "last_admin" || removeError === "last_admin"
              ? t("lastAdmin")
              : (saveError ?? removeError)}
          </p>
        )}

        {/* Role */}
        <div className="space-y-2">
          <span id="role-label" className="block text-label font-extrabold text-muted-foreground">
            {t("whatCanTheyDo")}
          </span>
          <div
            role="group"
            aria-labelledby="role-label"
            className="grid grid-cols-3 gap-1 p-[3px] rounded-full bg-card border border-border"
          >
            {(["admin", "caregiver", "viewer"] as Role[]).map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={role === r}
                onClick={() => setRole(r)}
                className={`min-h-touch-min flex items-center justify-center gap-1 rounded-full text-body transition-colors ${
                  role === r
                    ? "bg-profile text-on-profile font-extrabold"
                    : "font-bold text-foreground"
                }`}
              >
                {role === r && <Check size={16} strokeWidth={2} aria-hidden="true" />}
                {roleLabel(r)}
              </button>
            ))}
          </div>
          <p className="text-caption text-muted-foreground">{t(`roleDesc.${role}`)}</p>
        </div>

        {/* Who can they see */}
        <fieldset>
          <legend className="text-label font-extrabold text-muted-foreground mb-2">{t("whoCanTheySee")}</legend>
          <div className="grid grid-cols-2 gap-2">
            {profiles.map((p) => (
              <label
                key={p.id}
                className="min-h-[56px] flex items-center gap-2.5 px-4 rounded-[18px] border-[1.5px] border-border bg-card cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedProfiles.has(p.id)}
                  onChange={() => toggleProfile(p.id)}
                  className="w-[22px] h-[22px] flex-none accent-[var(--profile)]"
                />
                <span aria-hidden="true" data-profile-color={p.color} className="w-[30px] h-[30px] flex-none rounded-full flex items-center justify-center font-display text-title-5 bg-profile text-on-profile">
                  {p.name[0].toUpperCase()}
                </span>
                <span className="text-body font-extrabold">{p.name}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Remove */}
        <div className="rounded-card bg-card shadow-card p-4 space-y-2.5">
          {!confirmRemove ? (
            <button
              type="button"
              onClick={() => setConfirmRemove(true)}
              className="flex items-center gap-2 min-h-touch px-4 rounded-full border-[1.5px] border-destructive-border text-destructive text-body font-extrabold"
            >
              <Trash2 size={18} strokeWidth={2} aria-hidden="true" />
              {t("remove")}
            </button>
          ) : (
            <form action={removeAction} className="space-y-2">
              <input type="hidden" name="memberId" value={member.id} />
              <input type="hidden" name="householdId" value={householdId} />
              <p className="text-label font-bold">
                {t("removeConfirm", { name: member.displayName })}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmRemove(false)}
                  className="flex-1 min-h-touch rounded-full bg-primary text-primary-foreground text-label font-extrabold"
                >
                  {t("keepThem")}
                </button>
                <button
                  type="submit"
                  disabled={removePending}
                  className="flex-1 min-h-touch rounded-full border-[1.5px] border-destructive-border bg-card text-destructive text-label font-extrabold disabled:opacity-60"
                >
                  {removePending ? <Loader2 size={18} className="animate-spin mx-auto" aria-label={t("saving")} /> : t("removeButton")}
                </button>
              </div>
            </form>
          )}
          <p className="text-caption text-muted-foreground">
            {t("removeNote")}
          </p>
        </div>
      </form>

      <footer className="flex-none px-5 pb-7 pt-3">
        <button
          type="submit"
          form="manage-form"
          onClick={(e) => {
            const form = document.querySelector<HTMLFormElement>('form[action]');
            if (form) { e.preventDefault(); form.requestSubmit(); }
          }}
          disabled={savePending}
          className="w-full h-button flex items-center justify-center rounded-full bg-primary text-primary-foreground text-body-lg disabled:opacity-60"
        >
          {savePending ? <Loader2 size={20} strokeWidth={2} className="animate-spin" aria-label={t("saving")} /> : t("saveChanges")}
        </button>
      </footer>
    </div>
  );
}
