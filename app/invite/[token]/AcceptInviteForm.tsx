"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Lock, Check } from "lucide-react";
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
  roleLabel: string;
  capabilities: string[];
  expiresDate: string;
  alreadySignedIn: boolean;
}

const AVATAR_COLORS: Record<string, string> = {
  violet: "#5B3BE6",
  teal:   "#0F766E",
  rose:   "#B4235F",
  amber:  "#9A4A00",
  blue:   "#1D4F91",
};

export function AcceptInviteForm({
  token,
  inviterName,
  profiles,
  namesStr,
  roleLabel,
  capabilities,
  expiresDate,
  alreadySignedIn,
}: Props) {
  const [state, action, pending] = useActionState(acceptInviteAction, null);
  const [displayName, setDisplayName] = useState("");
  const isRedirecting = state && 'redirecting' in state;
  const stateError = state && 'error' in state ? state.error : undefined;

  if (isRedirecting) {
    // The server action will redirect; this state is transient
    return null;
  }

  return (
    <main className="min-h-dvh flex flex-col items-start justify-start px-5 pt-12 pb-8 bg-[var(--color-surface)] max-w-sm mx-auto">
      {/* Brand */}
      <p className="text-sm font-extrabold text-muted-foreground mb-8">Behavior Logger</p>

      {/* Avatar cluster */}
      <div className="flex items-center mb-5">
        {profiles.slice(0, 3).map((p, i) => (
          <span
            key={p.id}
            className="w-14 h-14 rounded-full flex items-center justify-center font-display text-[22px] font-semibold text-white border-2 border-[var(--color-surface)]"
            style={{
              backgroundColor: AVATAR_COLORS[p.color] ?? "#5B3BE6",
              marginLeft: i === 0 ? 0 : -10,
              zIndex: profiles.length - i,
            }}
          >
            {p.name[0].toUpperCase()}
          </span>
        ))}
        <span
          className="w-14 h-14 rounded-full border-2 border-dashed border-[var(--color-border)] bg-white flex items-center justify-center ml-[-10px]"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-muted-foreground">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
      </div>

      {/* Headline */}
      <h1 className="font-display text-[28px] font-semibold leading-tight mb-5">
        {inviterName} invited you to help care for {namesStr}
      </h1>

      {/* Role card */}
      <div className="w-full rounded-3xl bg-white p-4 mb-4 space-y-3">
        <p className="text-sm font-extrabold text-muted-foreground">
          You&rsquo;ll join as a {roleLabel}
        </p>
        <ul className="space-y-2">
          {capabilities.map((cap) => (
            <li key={cap} className="flex items-start gap-2">
              <Check size={16} strokeWidth={2} className="mt-0.5 flex-none text-[var(--color-profile)]" />
              <span className="text-sm font-bold">{cap}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Privacy line */}
      <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground mb-2">
        <Lock size={14} strokeWidth={2} className="flex-none" />
        {namesStr}&rsquo;s information stays private to their care team.
      </p>

      <p className="text-[13px] text-muted-foreground mb-6">
        Invite expires {expiresDate}
      </p>

      {stateError && (
        <p role="alert" className="w-full rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">
          {stateError}
        </p>
      )}

      {alreadySignedIn ? (
        <form action={action} className="w-full space-y-3">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="alreadySignedIn" value="true" />
          <div className="space-y-2">
            <label htmlFor="display-name" className="block text-sm font-extrabold text-muted-foreground">
              Your name in this household
            </label>
            <input
              id="display-name"
              name="displayName"
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Mom"
              className="w-full min-h-[52px] rounded-2xl border-[1.5px] border-[var(--color-border)] bg-white px-4 text-[17px] font-bold focus:outline-none focus:ring-2 focus:ring-[var(--color-profile)]"
            />
          </div>
          <button
            type="submit"
            disabled={pending || !displayName.trim()}
            className="w-full min-h-[52px] flex items-center justify-center rounded-full bg-foreground text-background text-[17px] font-extrabold disabled:opacity-60"
          >
            Join household
          </button>
        </form>
      ) : (
        <div className="w-full space-y-3">
          <Link
            href={`/auth/login?next=/invite/${token}`}
            className="w-full min-h-[52px] flex items-center justify-center rounded-full bg-foreground text-background text-[17px] font-extrabold"
          >
            Accept and create account
          </Link>
          <Link
            href={`/auth/login?next=/invite/${token}`}
            className="w-full min-h-[48px] flex items-center justify-center rounded-full border-[1.5px] border-[var(--color-profile)] text-[var(--color-profile)] text-[15px] font-extrabold"
          >
            I already have an account
          </Link>
        </div>
      )}
    </main>
  );
}
