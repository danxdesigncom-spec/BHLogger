"use server";

import { redirect } from "next/navigation";
import { updateProfileModules } from "@/lib/actions/profiles";
import { t } from "@/lib/i18n";

type State = null | { error: string };

export async function saveModules(
  _prev: State,
  formData: FormData,
): Promise<State> {
  const profileId = formData.get("profileId") as string;
  const modulesJson = formData.get("modules") as string;

  if (!profileId) return { error: t("errors.profileNotFound") };

  let modules: string[];
  try {
    modules = JSON.parse(modulesJson) as string[];
  } catch {
    return { error: t("errors.invalidModules") };
  }

  const result = await updateProfileModules({ profileId, enabledModules: modules });
  if ("error" in result) return { error: result.error };

  redirect(`/onboarding/done?profileId=${profileId}`);
}
