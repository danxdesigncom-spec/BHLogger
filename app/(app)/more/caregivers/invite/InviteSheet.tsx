"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, X, Check, UserPlus, Loader2 } from "lucide-react";
import { sendInvite, copyInviteLink } from "./actions";
import type { ProfileColor } from "@/lib/supabase/types";

const COLOR_CLASSES: Record<ProfileColor, string> = {
  violet: "bg-[var(--color-profile-violet)] text-white",
  teal:   "bg-[var(--color-profile-teal)] text-white",
  rose:   "bg-[var(--color-profile-rose)] text-white",
  amber:  "bg-[var(--color-profile-amber)] text-white",
  blue:   "bg-[var(--color-profile-blue)] text-white",
};

interface Profile {
  id: string;
  name: string;
  color: ProfileColor;
}

interface Props {
  householdId: string;
  profiles: Profile[];
}

type Role = "admin" | "caregiver" | "viewer";

const ROLES: { value: Role; label: string; desc: string }[] = [
  { value: "caregiver", label: "Caregiver", desc: "Logs and sees insights. Edits their own entries." },
  { value: "viewer",    label: "Viewer",    desc: "Sees and exports reports. Can't log." },
  { value: "admin",     label: "Admin",     desc: "Everything, including people and settings." },
];

export function InviteSheet({ householdId, profiles }: Props) {
  const router = useRouter();
  const [role, setRole] = useState<Role>("caregiver");
  const [selectedProfiles, setSelectedProfiles] = useState<Set<string>>(
    new Set(profiles.map((p) => p.id)),
  );
  const [copied, setCopied] = useState(false);
  const [state, action, pending] = useActionState(sendInvite, null);
  const stateError = state && 'error' in state ? state.error : undefined;
  const stateSuccess = state && 'success' in state;

  const toggleProfile = (id: string) =>
    setSelectedProfiles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });

  const handleCopy = async () => {
    const fd = new FormData();
    fd.append("householdId", householdId);
    fd.append("role", role);
    fd.append("profileIds", JSON.stringify(Array.from(selectedProfiles)));
    fd.append("email", "");
    const result = await copyInviteLink(fd);
    if ("inviteUrl" in result) {
      try {
        await navigator.clipboard.writeText(result.inviteUrl);
      } catch {
        // fallback: select text
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <>
      {/* Scrim */}
      <div
        aria-hidden="true"
        className="fixed inset-0 bg-foreground/40"
        onClick={() => router.back()}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        className="fixed left-0 right-0 top-14 bottom-0 flex flex-col bg-white rounded-t-[32px] overflow-hidden"
      >
        <div aria-hidden="true" className="w-10 h-[5px] self-center mt-2.5 rounded-full bg-[var(--color-border)]" />

        <header className="flex items-center justify-between gap-3 px-5 pt-3 pb-1">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 flex-none rounded-full bg-[var(--color-profile-bg)] text-[var(--color-profile)] flex items-center justify-center">
              <UserPlus size={24} strokeWidth={2} />
            </span>
            <div>
              <h1 id="sheet-title" className="font-display text-[26px] font-semibold leading-tight">
                Invite a caregiver
              </h1>
              <span className="text-sm font-bold text-muted-foreground">They get their own sign-in</span>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={() => router.back()}
            className="w-11 h-11 rounded-full bg-[var(--color-surface)] flex items-center justify-center"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </header>

        <form action={action} className="flex-1 overflow-y-auto flex flex-col gap-4 px-5 py-3">
          <input type="hidden" name="householdId" value={householdId} />
          <input type="hidden" name="role" value={role} />
          <input type="hidden" name="profileIds" value={JSON.stringify(Array.from(selectedProfiles))} />

          {stateError && (
            <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {stateError}
            </p>
          )}
          {stateSuccess && (
            <p role="status" className="rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-700">
              Invite sent!
            </p>
          )}

          {/* Email */}
          <div className="space-y-2">
            <label htmlFor="invite-email" className="block text-sm font-extrabold text-muted-foreground">
              Their email
            </label>
            <input
              id="invite-email"
              name="email"
              type="email"
              placeholder="name@email.com"
              className="w-full min-h-[52px] rounded-2xl border-[1.5px] border-[var(--color-border)] bg-white px-4 text-[17px] font-bold focus:outline-none focus:ring-2 focus:ring-[var(--color-profile)]"
            />
          </div>

          {/* Role */}
          <fieldset>
            <legend className="text-sm font-extrabold text-muted-foreground mb-2">What can they do?</legend>
            <div className="space-y-2">
              {ROLES.map(({ value, label, desc }) => (
                <label
                  key={value}
                  className={`min-h-[64px] flex items-center gap-3 px-4 py-2 rounded-[20px] border-[1.5px] cursor-pointer ${
                    role === value
                      ? "border-[var(--color-profile)] bg-[var(--color-profile-bg)]"
                      : "border-[var(--color-border)] bg-white"
                  }`}
                >
                  <input
                    type="radio"
                    name="roleVisual"
                    value={value}
                    checked={role === value}
                    onChange={() => setRole(value)}
                    className="w-[22px] h-[22px] flex-none accent-[var(--color-profile)]"
                  />
                  <span className="flex flex-col gap-[2px]">
                    <span className="text-base font-extrabold">{label}</span>
                    <span className="text-[13px] text-muted-foreground">{desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

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
                  <span className={`w-[30px] h-[30px] flex-none rounded-full flex items-center justify-center font-display text-[15px] font-semibold ${COLOR_CLASSES[p.color]}`}>
                    {p.name[0].toUpperCase()}
                  </span>
                  <span className="text-base font-extrabold">{p.name}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <span className="w-4 h-4 flex-none">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
              </svg>
            </span>
            Invites expire after 7 days. You can remove access anytime.
          </p>
        </form>

        <footer className="flex-none flex items-center gap-2.5 px-5 py-3 border-t border-[var(--color-border)] pb-7">
          <button
            type="button"
            onClick={handleCopy}
            className="min-h-[52px] flex items-center gap-1.5 px-4 rounded-full border-[1.5px] border-[var(--color-border)] bg-white text-foreground text-[15px] font-extrabold"
          >
            {copied ? <Check size={18} strokeWidth={2} /> : <Link2 size={18} strokeWidth={2} />}
            {copied ? "Copied!" : "Copy link"}
          </button>
          <button
            type="submit"
            form="invite-form"
            onClick={(e) => {
              // submit the form inside the form element
              const form = document.querySelector<HTMLFormElement>("form[action]");
              if (form) {
                e.preventDefault();
                form.requestSubmit();
              }
            }}
            disabled={pending}
            className="flex-1 min-h-[52px] flex items-center justify-center rounded-full bg-foreground text-background text-[17px] font-extrabold disabled:opacity-60"
          >
            {pending ? <Loader2 size={20} strokeWidth={2} className="animate-spin" /> : "Send invite"}
          </button>
        </footer>
      </section>
    </>
  );
}
