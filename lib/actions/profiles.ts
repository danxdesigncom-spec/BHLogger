"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { CareStage, ProfileColor, Toileting } from "@/lib/supabase/types";

export interface CreateProfileInput {
  householdId: string;
  name: string;
  careStage: CareStage;
  color: ProfileColor;
  toileting: Toileting;
  dob?: string | null;
  enabledModules?: string[];
}

export async function createProfile(
  input: CreateProfileInput,
): Promise<{ profileId: string } | { error: string }> {
  const supabase = await createClient();

  const defaultModules =
    input.careStage === "baby"
      ? ["bathroom", "eating", "mood", "medication"]
      : ["bathroom", "eating", "activity", "mood", "medication"];

  const { data, error } = await supabase
    .from("profiles")
    .insert({
      household_id: input.householdId,
      name: input.name,
      care_stage: input.careStage,
      color: input.color,
      toileting: input.toileting,
      dob: input.dob ?? null,
      enabled_modules: input.enabledModules ?? defaultModules,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { profileId: data.id };
}

export interface UpdateProfileModulesInput {
  profileId: string;
  enabledModules: string[];
}

export async function updateProfileModules(
  input: UpdateProfileModulesInput,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ enabled_modules: input.enabledModules })
    .eq("id", input.profileId);

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { success: true };
}
