"use server";

import { redirect } from "next/navigation";
import { acceptInvite } from "@/lib/actions/invites";
import { t } from "@/lib/i18n";

type State =
  | null
  | { redirecting: true }
  | { error: string };

export async function acceptInviteAction(
  _prev: State,
  formData: FormData,
): Promise<State> {
  const token = formData.get("token") as string;
  const displayName = (formData.get("displayName") as string) || "Caregiver";

  const initials = displayName
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const result = await acceptInvite(token, displayName, initials);

  if ("error" in result) {
    if (result.error.includes("Invalid or expired")) {
      return { error: t("errors.inviteExpired") };
    }
    return { error: result.error };
  }

  redirect("/");
}
