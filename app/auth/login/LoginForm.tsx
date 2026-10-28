"use client";

import { useActionState, use } from "react";
import { sendMagicLink } from "./actions";
import { Mail, Loader2 } from "lucide-react";
import { enterDemoMode } from "../demo/actions";
import { DEMO_ENABLED } from "@/lib/demo";

interface Props {
  searchParams: Promise<{ error?: string; next?: string }>;
}

export function LoginForm({ searchParams }: Props) {
  const params = use(searchParams);
  const next = params.next ?? "/";
  const callbackError = params.error;

  const [state, action, pending] = useActionState(sendMagicLink, null);

  if (state?.sent) {
    return (
      <div className="rounded-3xl bg-white p-6 shadow-sm space-y-3 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-profile-tint">
          <Mail className="text-profile" size={24} strokeWidth={2} />
        </div>
        <h2 className="font-display text-2xl font-semibold">Check your email</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          We sent a sign-in link to <strong>{state.email}</strong>. It expires
          in 1 hour.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />

      {(state?.error ?? callbackError) && (
        <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {state?.error ?? "Sign-in failed. Please try again."}
        </p>
      )}

      <div className="space-y-2">
        <label
          htmlFor="email"
          className="block text-sm font-extrabold text-muted-foreground"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          className="w-full min-h-[52px] rounded-2xl border border-[var(--color-border)] bg-white px-4 text-[17px] font-bold text-foreground placeholder:font-normal placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-[var(--color-profile)] disabled:opacity-50"
          disabled={pending}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full min-h-[52px] flex items-center justify-center gap-2 rounded-full bg-foreground text-background text-[17px] font-extrabold disabled:opacity-60"
      >
        {pending ? (
          <Loader2 size={20} strokeWidth={2} className="animate-spin" />
        ) : (
          "Send magic link"
        )}
      </button>

      {DEMO_ENABLED && (
        <button
          type="submit"
          formAction={enterDemoMode}
          formNoValidate
          className="w-full min-h-[52px] flex items-center justify-center rounded-full border-[1.5px] border-[var(--color-border)] bg-white text-foreground text-[17px] font-extrabold"
        >
          Continue without saving
        </button>
      )}
    </form>
  );
}
