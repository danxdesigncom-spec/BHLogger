"use server";

import { redirect } from "next/navigation";
import { updateProfileModules } from "@/lib/actions/profiles";

type State = null | { error: string };

export async function saveModules(
  _prev: State,
  formData: FormData,
): Promise<State> {
  const profileId = formData.get("profileId") as string;
  const modulesJson = formData.get("modules") as string;

  if (!profileId) return { error: "Profile not found." };

  let modules: string[];
  try {
    modules = JSON.parse(modulesJson) as string[];
  } catch {
    return { error: "Invalid module selection." };
  }

  const result = await updateProfileModules({ profileId, enabledModules: modules });
  if ("error" in result) return { error: result.error };

  redirect(`/onboarding/done?profileId=${profileId}`);
}
