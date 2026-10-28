"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Lock, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { acceptInviteAction } from "./actions";

interface Profile {
  id: string;
  name: string;
  color: string;
}

interface Props {
  token: string;
  inviterName: string;
  profiles: Profile[];
  namesStr: string;
  role: string;
  capabilities: string[];
  expiresDate: string;
  alreadySignedIn: boolean;
}

export function AcceptInviteForm({
  token,
  inviterName,
  profiles,
  namesStr,
  role,
  capabilities,
  expiresDate,
  alreadySignedIn,
}: Props) {
  const [state, action, pending] = useActionState(acceptInviteAction, null);
  const [displayName, setDisplayName] = useState("");
  const t = useTranslations();
  const isRedirecting = state && 'redirecting' in state;
  const stateError = state && 'error' in state ? state.error : undefined;

  if (isRedirecting) {
    // The server action will redirect; this state is transient
    return null;
  }

  return (
    <main className="min-h-dvh flex flex-col items-start justify-start px-5 pt-12 pb-8 max-w-sm mx-auto">
      {/* Brand */}
      <p className="text-label font-extrabold text-muted-foreground mb-8">{t("app.name")}</p>

      {/* Avatar cluster */}
      <div className="flex items-center mb-5">
        {profiles.slice(0, 3).map((p, i) => (
          <span
            key={p.id}
            aria-hidden="true"
            data-profile-color={p.color}
            className="w-14 h-14 rounded-full flex items-center justify-center font-display text-title-3 bg-profile text-on-profile border-2 border-card"
            style={{ marginLeft: i === 0 ? 0 : -10, zIndex: profiles.length - i }}
          >
            {p.name[0].toUpperCase()}
          </span>
        ))}
        <span
          className="w-14 h-14 rounded-full border-2 border-dashed border-dashed-line bg-card flex items-center justify-center ml-[-10px]"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-muted-foreground">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
      </div>

      {/* Headline */}
      <h1 className="font-display text-title-1 mb-5">
        {t("invite.headline", { inviter: inviterName, names: namesStr })}
      </h1>

      {/* Role card */}
      <div className="w-full rounded-card bg-card shadow-card p-4 mb-4 space-y-3">
        <p className="text-label font-extrabold text-muted-foreground">
          {t("invite.joinAs", { role })}
        </p>
        <ul className="space-y-2">
          {capabilities.map((cap) => (
            <li key={cap} className="flex items-start gap-2">
              <Check size={16} strokeWidth={2} className="mt-0.5 flex-none text-profile" aria-hidden="true" />
              <span className="text-label font-bold">{cap}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Privacy line */}
      <p className="flex items-center gap-1.5 text-caption text-muted-foreground mb-2">
        <Lock size={14} strokeWidth={2} className="flex-none" aria-hidden="true" />
        {t("invite.privacy", { names: namesStr })}
      </p>

      <p className="text-caption text-muted-foreground mb-6">
        {t("invite.expires", { date: expiresDate })}
      </p>

      {stateError && (
        <p role="alert" className="w-full rounded-lg border border-flag-border bg-flag px-4 py-3 text-label font-bold text-flag-ink mb-4">
          {stateError}
        </p>
      )}

      {alreadySignedIn ? (
        <form action={action} className="w-full space-y-3">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="alreadySignedIn" value="true" />
          <div className="space-y-2">
            <label htmlFor="display-name" className="block text-label font-extrabold text-muted-foreground">
              {t("invite.yourName")}
            </label>
            <input
              id="display-name"
              name="displayName"
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t("invite.namePlaceholder")}
              className="w-full h-button rounded-lg border-[1.5px] border-input bg-card px-4 text-[16px] font-bold focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>
          <button
            type="submit"
            disabled={pending || !displayName.trim()}
            className="w-full h-button flex items-center justify-center rounded-full bg-primary text-primary-foreground text-body-lg disabled:opacity-60"
          >
            {t("invite.join")}
          </button>
        </form>
      ) : (
        <div className="w-full space-y-3">
          <Link
            href={`/auth/login?next=/invite/${token}`}
            className="w-full h-button flex items-center justify-center rounded-full bg-primary text-primary-foreground text-body-lg"
          >
            {t("invite.accept")}
          </Link>
          <Link
            href={`/auth/login?next=/invite/${token}`}
            className="w-full h-button flex items-center justify-center rounded-full border-[1.5px] border-border-strong bg-card text-foreground text-body-md"
          >
            {t("invite.haveAccount")}
          </Link>
        </div>
      )}
    </main>
  );
}
