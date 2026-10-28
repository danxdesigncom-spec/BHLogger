import type { ProfileColor, Toileting } from "@/lib/supabase/types";
import type { ProfileSummary } from "@/lib/context/household-provider";

export function toProfileSummary(p: {
  id: string; name: string; color: string; care_stage: string; dob: string | null; toileting: string;
  feeding_methods: string[]; enabled_modules: string[]; settings: unknown; care_card: unknown;
}): ProfileSummary {
  return {
    id: p.id,
    name: p.name,
    color: p.color as ProfileColor,
    initials: p.name[0]?.toUpperCase() ?? "?",
    careStage: p.care_stage as ProfileSummary["careStage"],
    dob: p.dob,
    toileting: p.toileting as Toileting,
    feedingMethods: p.feeding_methods ?? [],
    enabledModules: p.enabled_modules?.length ? p.enabled_modules : ["bathroom", "eating", "activity", "mood", "medication"],
    settings: (p.settings as Record<string, unknown>) ?? {},
    careCard: (p.care_card as Record<string, unknown>) ?? {},
  };
}
