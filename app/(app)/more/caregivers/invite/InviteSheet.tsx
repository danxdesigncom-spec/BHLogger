"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, X, Check, UserPlus, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { sendInvite, copyInviteLink } from "./actions";
import type { ProfileColor } from "@/lib/supabase/types";
import { roleLabel } from "@/lib/options";

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

const ROLES: Role[] = ["caregiver", "viewer", "admin"];

export function InviteSheet({ householdId, profiles }: Props) {
  const router = useRouter();
  const t = useTranslations("caregivers");
  const tc = useTranslations("common");
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
        className="fixed inset-0 bg-[var(--overlay)]"
        onClick={() => router.back()}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        className="fixed left-0 right-0 top-14 bottom-0 flex flex-col bg-card rounded-t-sheet overflow-hidden md:left-1/2 md:right-auto md:top-1/2 md:bottom-auto md:-translate-x-1/2 md:-translate-y-1/2 md:w-[480px] md:max-h-[85dvh] md:rounded-sheet"
      >
        <div aria-hidden="true" className="w-10 h-[5px] self-center mt-2.5 rounded-full bg-grabber" />

        <header className="flex items-center justify-between gap-3 px-5 pt-3 pb-1">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 flex-none rounded-full bg-profile-tint text-profile-ink flex items-center justify-center">
              <UserPlus size={24} strokeWidth={2} aria-hidden="true" />
            </span>
            <div>
              <h1 id="sheet-title" className="font-display text-title-1">
                {t("inviteTitle")}
              </h1>
              <span className="text-label font-bold text-muted-foreground">{t("inviteSubtitle")}</span>
            </div>
          </div>
          <button
            type="button"
            aria-label={tc("close")}
            onClick={() => router.back()}
            className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center"
          >
            <X size={20} strokeWidth={2} aria-hidden="true" />
          </button>
        </header>

        <form action={action} className="flex-1 overflow-y-auto flex flex-col gap-4 px-5 py-3">
          <input type="hidden" name="householdId" value={householdId} />
          <input type="hidden" name="role" value={role} />
          <input type="hidden" name="profileIds" value={JSON.stringify(Array.from(selectedProfiles))} />

          {stateError && (
            <p role="alert" className="rounded-lg border border-flag-border bg-flag px-4 py-3 text-label font-bold text-flag-ink">
              {stateError}
            </p>
          )}
          {stateSuccess && (
            <p role="status" className="rounded-lg bg-success px-4 py-3 text-label font-bold text-success-ink">
              {t("inviteSent")}
            </p>
          )}

          {/* Email */}
          <div className="space-y-2">
            <label htmlFor="invite-email" className="block text-label font-extrabold text-muted-foreground">
              {t("email")}
            </label>
            <input
              id="invite-email"
              name="email"
              type="email"
              placeholder={t("emailPlaceholder")}
              className="w-full h-button rounded-lg border-[1.5px] border-input bg-card px-4 text-[16px] font-bold focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>

          {/* Role */}
          <fieldset>
            <legend className="text-label font-extrabold text-muted-foreground mb-2">{t("whatCanTheyDo")}</legend>
            <div className="space-y-2">
              {ROLES.map((value) => (
                <label
                  key={value}
                  className={`min-h-[64px] flex items-center gap-3 px-4 py-2 rounded-[20px] border-[1.5px] cursor-pointer ${
                    role === value ? "border-profile bg-profile-tint" : "border-border bg-card"
                  }`}
                >
                  <input
                    type="radio"
                    name="roleVisual"
                    value={value}
                    checked={role === value}
                    onChange={() => setRole(value)}
                    className="w-[22px] h-[22px] flex-none accent-[var(--profile)]"
                  />
                  <span className="flex flex-col gap-[2px]">
                    <span className="text-body font-extrabold">{roleLabel(value)}</span>
                    <span className="text-caption text-muted-foreground">{t(`roleInvite.${value}`)}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

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

          <p className="flex items-center gap-1.5 text-caption text-muted-foreground">
            <span className="w-4 h-4 flex-none">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
              </svg>
            </span>
            {t("expires")}
          </p>
        </form>

        <footer className="flex-none flex items-center gap-2.5 px-5 pt-3 border-t border-divider" style={{ paddingBottom: "calc(28px + env(safe-area-inset-bottom, 0px))" }}>
          <button
            type="button"
            onClick={handleCopy}
            className="h-button flex items-center gap-1.5 px-4 rounded-full border-[1.5px] border-border-strong bg-card text-foreground text-body-md"
          >
            {copied ? <Check size={18} strokeWidth={2} aria-hidden="true" /> : <Link2 size={18} strokeWidth={2} aria-hidden="true" />}
            {copied ? t("copied") : t("copyLink")}
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
            className="flex-1 h-button flex items-center justify-center rounded-full bg-primary text-primary-foreground text-body-lg disabled:opacity-60"
          >
            {pending ? <Loader2 size={20} strokeWidth={2} className="animate-spin" aria-label={t("sending")} /> : t("sendInvite")}
          </button>
        </footer>
      </section>
    </>
  );
}
