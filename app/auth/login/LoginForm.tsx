"use client";

import { useActionState, use } from "react";
import { sendMagicLink } from "./actions";
import { Mail, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("auth");

  if (state?.sent) {
    return (
      <div role="status" className="rounded-card bg-card p-6 shadow-card space-y-3 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-profile-tint">
          <Mail className="text-profile-ink" size={24} strokeWidth={2} aria-hidden="true" />
        </div>
        <h2 className="font-display text-title-2">{t("checkEmail")}</h2>
        <p className="text-body font-normal text-muted-foreground">
          {t.rich("sentTo", { email: state.email ?? "", strong: (chunks) => <strong>{chunks}</strong> })}
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />

      {(state?.error ?? callbackError) && (
        <p role="alert" className="rounded-lg border border-flag-border bg-flag px-4 py-3 text-label font-bold text-flag-ink">
          {state?.error ?? t("failed")}
        </p>
      )}

      <div className="space-y-2">
        <label
          htmlFor="email"
          className="block text-label font-extrabold text-muted-foreground"
        >
          {t("email")}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder={t("emailPlaceholder")}
          className="w-full h-button rounded-lg border border-input bg-card px-4 text-[16px] font-bold text-foreground placeholder:font-normal placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-50"
          disabled={pending}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full h-button flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground text-body-lg disabled:opacity-60"
      >
        {pending ? (
          <Loader2 size={20} strokeWidth={2} className="animate-spin" aria-label={t("sending")} />
        ) : (
          t("send")
        )}
      </button>

      {DEMO_ENABLED && (
        <button
          type="submit"
          formAction={enterDemoMode}
          formNoValidate
          className="w-full h-button flex items-center justify-center rounded-full border-[1.5px] border-border-strong bg-card text-foreground text-body-lg"
        >
          {t("demo")}
        </button>
      )}
    </form>
  );
}
