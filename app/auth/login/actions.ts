"use server";

import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { t } from "@/lib/i18n";
import { safeNext } from "@/lib/auth/safe-next";

type State =
  | null
  | { sent: true; email: string }
  | { sent: false; error: string };

export async function sendMagicLink(
  _prev: State,
  formData: FormData,
): Promise<State> {
  const email = formData.get("email");
  const next = safeNext(formData.get("next"));

  if (!email || typeof email !== "string") {
    return { sent: false, error: t("errors.enterEmail") };
  }

  const supabase = await createClient();
  // The configured app URL wins over the request's Origin header, so the link always points at this app.
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? (await headers()).get("origin") ?? "http://localhost:3000";

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      shouldCreateUser: true,
    },
  });

  if (error) {
    return { sent: false, error: t("errors.somethingWrong") };
  }

  return { sent: true, email };
}
