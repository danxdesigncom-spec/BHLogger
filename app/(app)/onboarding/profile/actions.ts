"use server";

import { redirect } from "next/navigation";
import { createHousehold } from "@/lib/actions/household";
import { createProfile } from "@/lib/actions/profiles";
import type { ProfileColor, CareStage, Toileting } from "@/lib/supabase/types";

type State = null | { error: string };

export async function submitProfileStep(
  _prev: State,
  formData: FormData,
): Promise<State> {
  const name = formData.get("name") as string;
  const careStage = formData.get("careStage") as CareStage;
  const toileting = formData.get("toileting") as Toileting;
  const color = formData.get("color") as ProfileColor;
  const dob = (formData.get("dob") as string | null) || null;
  const displayName = (formData.get("displayName") as string) || "Me";
  const householdNameInput = (formData.get("householdName") as string) || "";
  let householdId = (formData.get("householdId") as string) || null;

  if (!name?.trim()) return { error: "Please enter a name." };

  // Create the household if this is the first profile
  if (!householdId) {
    const hhName = householdNameInput.trim() || `${name}'s household`;
    const initials = displayName
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

    const result = await createHousehold(hhName, displayName, initials);
    if ("error" in result) return { error: result.error };
    householdId = result.householdId;
  }

  const profileResult = await createProfile({
    householdId,
    name: name.trim(),
    careStage,
    color,
    toileting,
    dob,
  });

  if ("error" in profileResult) return { error: profileResult.error };

  redirect(`/onboarding/modules?profileId=${profileResult.profileId}`);
}
