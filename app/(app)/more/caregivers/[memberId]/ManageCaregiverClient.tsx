"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2, Check, Loader2 } from "lucide-react";
import { saveMember, removeMemberAction } from "./actions";
import type { ProfileColor } from "@/lib/supabase/types";

const COLOR_CLASSES: Record<ProfileColor, string> = {
  violet: "bg-profile text-white",
  teal:   "bg-profile text-white",
  rose:   "bg-profile text-white",
  amber:  "bg-profile text-white",
  blue:   "bg-profile text-white",
};

type Role = "admin" | "caregiver" | "viewer";

const ROLE_DESCS: Record<Role, string> = {
  admin:     "Admins can invite and remove caregivers and manage profiles.",
  caregiver: "Caregivers log and see insights, and can edit their own entries.",
  viewer:    "Viewers can see the timeline and export reports.",
};

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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `today at ${new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  return formatDate(iso);
}

export function ManageCaregiverClient({ householdId, member, profiles }: Props) {
  const router = useRouter();
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
          aria-label="Back to More"
          onClick={() => router.back()}
          className="w-11 h-11 flex-none rounded-full bg-white shadow-sm flex items-center justify-center"
        >
          <ArrowLeft size={22} strokeWidth={2} />
        </button>
      </header>

      {/* Avatar + name */}
      <div className="flex items-center gap-4 px-5 pt-4 pb-0">
        <span
          aria-hidden="true"
          className="w-[72px] h-[72px] flex-none rounded-full bg-[var(--color-secondary)] text-foreground flex items-center justify-center font-display text-[30px] font-semibold"
        >
          {member.initials}
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[30px] font-semibold leading-tight">{member.displayName}</h1>
          <span className="text-sm text-muted-foreground leading-snug">
            Joined {formatDate(member.joinedAt)} ·{" "}
            {member.lastLoggedAt
              ? `last logged ${formatRelative(member.lastLoggedAt)}`
              : "hasn't logged yet"}
          </span>
        </div>
      </div>

      <form action={saveAction} className="flex flex-col gap-5 px-5 pt-6 pb-4 flex-1">
        <input type="hidden" name="memberId" value={member.id} />
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="role" value={role} />
        <input type="hidden" name="profileIds" value={JSON.stringify(profileIdsToSave)} />

        {(saveError ?? removeError) && (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {saveError === "last_admin" || removeError === "last_admin"
              ? "You can't remove or demote the last admin."
              : (saveError ?? removeError)}
          </p>
        )}

        {/* Role */}
        <div className="space-y-2">
          <span id="role-label" className="block text-sm font-extrabold text-muted-foreground">
            What can they do?
          </span>
          <div
            role="group"
            aria-labelledby="role-label"
            className="grid grid-cols-3 gap-1 p-[3px] rounded-full bg-white border border-[var(--color-border)]"
          >
            {(["admin", "caregiver", "viewer"] as Role[]).map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={role === r}
                onClick={() => setRole(r)}
                className={`min-h-[44px] flex items-center justify-center gap-1 rounded-full text-[15px] transition-colors ${
                  role === r
                    ? "bg-[var(--color-profile)] text-white font-extrabold"
                    : "font-bold text-foreground"
                }`}
              >
                {role === r && <Check size={16} strokeWidth={2} />}
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
          <p className="text-[13px] text-muted-foreground leading-snug">{ROLE_DESCS[role]}</p>
        </div>

        {/* Who can they see */}
        <fieldset>
          <legend className="text-sm font-extrabold text-muted-foreground mb-2">Who can they see?</legend>
          <div className="grid grid-cols-2 gap-2">
            {profiles.map((p) => (
              <label
                key={p.id}
                className="min-h-[56px] flex items-center gap-2.5 px-4 rounded-[18px] border-[1.5px] border-[var(--color-border)] bg-white cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedProfiles.has(p.id)}
                  onChange={() => toggleProfile(p.id)}
                  className="w-[22px] h-[22px] flex-none accent-[var(--color-profile)]"
                />
                <span data-profile-color={p.color} className={`w-[30px] h-[30px] flex-none rounded-full flex items-center justify-center font-display text-[15px] font-semibold ${COLOR_CLASSES[p.color]}`}>
                  {p.name[0].toUpperCase()}
                </span>
                <span className="text-base font-extrabold">{p.name}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Remove */}
        <div className="rounded-[20px] bg-white shadow-sm p-4 space-y-2.5">
          {!confirmRemove ? (
            <button
              type="button"
              onClick={() => setConfirmRemove(true)}
              className="flex items-center gap-2 min-h-[48px] px-4 rounded-full border-[1.5px] border-[#E8A39B] text-[#B42318] text-[15px] font-extrabold"
            >
              <Trash2 size={18} strokeWidth={2} />
              Remove from household
            </button>
          ) : (
            <form action={removeAction} className="space-y-2">
              <input type="hidden" name="memberId" value={member.id} />
              <input type="hidden" name="householdId" value={householdId} />
              <p className="text-sm font-bold">
                Remove {member.displayName} from the household?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmRemove(false)}
                  className="flex-1 min-h-[44px] rounded-full border-[1.5px] border-[var(--color-border)] text-sm font-extrabold"
                >
                  Keep them
                </button>
                <button
                  type="submit"
                  disabled={removePending}
                  className="flex-1 min-h-[44px] rounded-full bg-[#B42318] text-white text-sm font-extrabold disabled:opacity-60"
                >
                  {removePending ? <Loader2 size={18} className="animate-spin mx-auto" /> : "Remove"}
                </button>
              </div>
            </form>
          )}
          <p className="text-[13px] text-muted-foreground leading-snug">
            They lose access right away. Their past entries stay, labeled with their name.
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
          className="w-full min-h-[52px] flex items-center justify-center rounded-full bg-foreground text-background text-[17px] font-extrabold disabled:opacity-60"
        >
          {savePending ? <Loader2 size={20} strokeWidth={2} className="animate-spin" /> : "Save changes"}
        </button>
      </footer>
    </div>
  );
}
