"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/app/auth/demo/actions";
import { DEMO_OVERRIDES_COOKIE, readDemoOverrides, type DemoOverrides } from "@/lib/demo/overrides";
import type { Json } from "@/lib/supabase/types";

type Result = { success: true } | { error: string };

const HouseholdSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  settings: z
    .object({
      volume_unit: z.enum(["ml", "oz"]).optional(),
      time_format: z.enum(["12h", "24h"]).optional(),
      week_start: z.enum(["sunday", "monday"]).optional(),
    })
    .strict()
    .optional(),
});

const ProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(40).optional(),
    color: z.enum(["violet", "teal", "rose", "amber", "blue"]).optional(),
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    care_stage: z.enum(["baby", "child", "teen_adult"]).optional(),
    toileting: z.enum(["diapers", "training", "toilet"]).optional(),
    feeding_methods: z.array(z.enum(["breast", "bottle", "meal", "snack", "drink"])).max(5).optional(),
    enabled_modules: z.array(z.enum(["bathroom", "eating", "activity", "mood", "medication"])).max(5).optional(),
    care_card: z.record(z.unknown()).optional(),
    archived: z.boolean().optional(),
  })
  .strict();

async function writeDemo(update: (o: DemoOverrides) => DemoOverrides) {
  const next = update(await readDemoOverrides());
  (await cookies()).set(DEMO_OVERRIDES_COOKIE, JSON.stringify(next), { path: "/", sameSite: "lax", httpOnly: true });
  revalidatePath("/", "layout");
}

/** SET-01 units and formats, ACC-04 household name. Admins only (RLS). */
export async function updateHousehold(householdId: string, input: unknown): Promise<Result> {
  const parsed = HouseholdSchema.safeParse(input);
  if (!parsed.success || !z.string().uuid().safeParse(householdId).success) return { error: "Invalid settings." };

  if (await isDemoMode()) {
    await writeDemo((o) => ({
      ...o,
      household: {
        ...o.household,
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
        settings: { ...o.household?.settings, ...parsed.data.settings },
      },
    }));
    return { success: true };
  }

  const supabase = await createClient();
  const { data: current } = await supabase.from("households").select("settings").eq("id", householdId).maybeSingle();
  if (!current) return { error: "Household not found." };
  const { data, error } = await supabase
    .from("households")
    .update({
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      settings: { ...(current.settings as Record<string, unknown>), ...parsed.data.settings } as Json,
    })
    .eq("id", householdId)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Only an admin can change household settings." };
  revalidatePath("/", "layout");
  return { success: true };
}

/** ACC-05/06 profile fields, SET-04 modules, ACC-12 care card, ACC-13 archive. Admins only (RLS). */
export async function updateProfile(profileId: string, input: unknown): Promise<Result> {
  const parsed = ProfileSchema.safeParse(input);
  if (!parsed.success || !z.string().uuid().safeParse(profileId).success) return { error: "Invalid profile change." };
  const { archived, care_card, ...fields } = parsed.data;

  if (await isDemoMode()) {
    await writeDemo((o) => ({
      ...o,
      profiles: { ...o.profiles, [profileId]: { ...o.profiles?.[profileId], ...fields, ...(care_card ? { care_card } : {}), ...(archived !== undefined ? { archived } : {}) } },
    }));
    return { success: true };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({
      ...fields,
      ...(care_card ? { care_card: care_card as Json } : {}),
      ...(archived !== undefined ? { archived_at: archived ? new Date().toISOString() : null } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", profileId)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Only an admin can change this profile." };
  revalidatePath("/", "layout");
  return { success: true };
}
