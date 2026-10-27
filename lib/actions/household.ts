"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createHousehold(
  name: string,
  displayName: string,
  initials: string,
): Promise<{ householdId: string } | { error: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("create_household", {
    p_name: name,
    p_display_name: displayName,
    p_initials: initials,
  });

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { householdId: data as string };
}
