"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { Group, ToggleChips } from "../controls";
import { useEntries } from "@/lib/data/hooks";
import { useOptionSet } from "@/lib/data/useOptionSet";
import { useRepo } from "@/lib/data/repo-context";
import { humanize } from "@/lib/options";

/**
 * EAT-08: foods from the profile's own list, most recently eaten first. Adding a new food is the only typing.
 * Shared with tube formulas (EAT-10), which are the same kind of personal list.
 */
export function PersonalListPicker({
  profileId, module, selected, onChange, label, addLabel, nameLabel, multiple = true,
}: {
  profileId: string | null;
  module: "food" | "formula";
  selected: string[];
  onChange: (keys: string[]) => void;
  label: string;
  addLabel: string;
  nameLabel: string;
  multiple?: boolean;
}) {
  const t = useTranslations();
  const repo = useRepo();
  const qc = useQueryClient();
  const { options } = useOptionSet(profileId, module, []);
  const since = useMemo(() => new Date(Date.now() - 30 * 86_400_000).toISOString(), []);
  const recent = useEntries({ profileId: profileId ?? undefined, types: ["eating"], from: since }, !!profileId);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const field = module === "food" ? "food_ids" : "formula_id";
  const lastUsed = new Map<string, string>();
  for (const e of recent.data ?? []) {
    const v = (e.data as Record<string, unknown>)[field];
    for (const key of Array.isArray(v) ? v : v ? [v] : []) if (!lastUsed.has(String(key))) lastUsed.set(String(key), e.occurred_at);
  }
  const sorted = [...options].sort((a, b) => (lastUsed.get(b.key) ?? "").localeCompare(lastUsed.get(a.key) ?? "") || a.label.localeCompare(b.label));
  // Keep an archived or not-yet-loaded choice visible while editing an older entry.
  for (const key of selected) if (!sorted.some((o) => o.key === key)) sorted.push({ key, label: humanize(key.replace(/^opt_/, "")) });

  const toggle = (key: string) =>
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : multiple ? [...selected, key] : [key]);

  const add = async () => {
    const label = name.trim();
    if (!label || !profileId) return;
    const existing = options.find((o) => o.label.toLowerCase() === label.toLowerCase());
    if (!existing) {
      const result = await repo.addOption({ profileId, module, label, icon: null });
      if ("error" in result) return setError(result.error);
      await qc.invalidateQueries({ queryKey: ["options"] });
    }
    const key = existing?.key ?? (await repo.listOptions(profileId, module)).find((o) => o.label.toLowerCase() === label.toLowerCase())?.key;
    if (key && !selected.includes(key)) onChange(multiple ? [...selected, key] : [key]);
    setAdding(false);
    setName("");
    setError(null);
  };

  return (
    <Group label={label} hint={t("common.optional")}>
      <ToggleChips
        visibleCount={8}
        options={sorted.map((o) => ({ value: o.key, label: o.label }))}
        selected={selected}
        onToggle={toggle}
        onAdd={() => setAdding(true)}
        addLabel={addLabel}
      />
      {adding && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <label className="flex-1">
            <span className="sr-only">{nameLabel}</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              placeholder={nameLabel}
              className="w-full h-button rounded-full border border-input bg-card px-4 text-[16px] font-bold"
            />
          </label>
          <button type="submit" className="h-button px-5 rounded-full bg-primary text-primary-foreground text-body font-extrabold">{t("common.add")}</button>
        </form>
      )}
      {error && <p role="alert" className="text-caption font-bold text-destructive">{error}</p>}
    </Group>
  );
}
