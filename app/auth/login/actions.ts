"use server";

import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

type State =
  | null
  | { sent: true; email: string }
  | { sent: false; error: string };

export async function sendMagicLink(
  _prev: State,
  formData: FormData,
): Promise<State> {
  const email = formData.get("email");
  const next = (formData.get("next") as string | null) ?? "/";

  if (!email || typeof email !== "string") {
    return { sent: false, error: "Please enter your email address." };
  }

  const supabase = await createClient();
  const headerList = await headers();
  const origin = headerList.get("origin") ?? "http://localhost:3000";

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      shouldCreateUser: true,
    },
  });

  if (error) {
    return { sent: false, error: "Something went wrong. Please try again." };
  }

  return { sent: true, email };
}
