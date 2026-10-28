"use client";

import { useOptions, useProfileSettings } from "./hooks";
import type { Option } from "@/lib/options";

/** SET-04: built-in options minus the ones hidden for this profile, plus custom (non-archived) options. */
export function useOptionSet(profileId: string | null, module: "activity" | "feeling" | "behavior" | "prn_reason", builtIn: Option[]) {
  const custom = useOptions(profileId, module);
  const settings = useProfileSettings(profileId) as { hidden_options?: Record<string, string[]> };
  const hidden = new Set(settings.hidden_options?.[module] ?? []);
  const customOptions = (custom.data ?? []).map((o) => ({ key: o.key, label: o.label }));
  return {
    options: [...builtIn.filter((o) => !hidden.has(o.key)), ...customOptions.filter((o) => !builtIn.some((b) => b.key === o.key))],
    custom: customOptions,
    hidden,
  };
}
