"use client";

import { useCallback } from "react";
import { useOptions, useProfileSettings } from "./hooks";
import { humanize, type Option } from "@/lib/options";

export type OptionLabel = (module: "food" | "formula", key: string) => string;

/** EAT-08 / EAT-10: names of a profile's foods and formulas, with a readable fallback for unknown keys. */
export function useOptionLabels(profileId: string | null): OptionLabel {
  const food = useOptions(profileId, "food");
  const formula = useOptions(profileId, "formula");
  return useCallback<OptionLabel>(
    (module, key) => ((module === "food" ? food.data : formula.data) ?? []).find((o) => o.key === key)?.label ?? humanize(key.replace(/^opt_/, "")),
    [food.data, formula.data],
  );
}

/** SET-04: built-in options minus the ones hidden for this profile, plus custom (non-archived) options. */
export function useOptionSet(profileId: string | null, module: "activity" | "feeling" | "behavior" | "prn_reason" | "food" | "formula", builtIn: Option[]) {
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
