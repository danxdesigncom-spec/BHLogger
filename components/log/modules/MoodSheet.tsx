"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import type { ModuleFormContext } from "../LogSheet";
import { FaceScale, Group, RadioChips, Segmented, ToggleChips } from "../controls";
import { useHousehold } from "@/lib/context/household-provider";
import { useOptionSet } from "@/lib/data/useOptionSet";
import { BEHAVIOR_DURATIONS, behaviors as behaviorOptions, durationLabel, FEELINGS, moodLabels, SEVERITIES } from "@/lib/options";

type Severity = "mild" | "moderate" | "severe";

export function MoodSheet({ ctx, scope: scopeProp, initial }: { ctx: ModuleFormContext; scope?: "moment" | "day"; initial?: Record<string, unknown> }) {
  const { activeProfile } = useHousehold();
  const stage = activeProfile?.careStage ?? "child";
  const labels = moodLabels(stage);
  const t = useTranslations();
  const m = (k: string, v?: Record<string, string | number>) => t(`moodSheet.${k}`, v);
  const feelingOptions = useOptionSet(activeProfile?.id ?? null, "feeling", FEELINGS[stage]).options;
  const behaviorSet = useOptionSet(activeProfile?.id ?? null, "behavior", behaviorOptions(stage)).options;
  const behaviorList = stage === "baby" ? [] : behaviorSet;

  const init = (initial ?? {}) as {
    scope?: "moment" | "day"; level?: number; feelings?: string[];
    behaviors?: { key: string; severity?: Severity; duration_min?: number }[]; energy?: "low" | "normal" | "high";
  };
  const scope = scopeProp ?? init.scope ?? "moment";
  const [level, setLevel] = useState<number | null>(init.level ?? null);
  const [feelings, setFeelings] = useState<string[]>(init.feelings ?? []);
  const [behaviors, setBehaviors] = useState<{ key: string; severity?: Severity; duration_min?: number }[]>(init.behaviors ?? []);
  const [energy, setEnergy] = useState<"low" | "normal" | "high" | null>(init.energy ?? null);

  useEffect(() => {
    if (level === null) return;
    ctx.setData({ scope, level, feelings, behaviors, ...(energy ? { energy } : {}) }, labels[level - 1], true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, feelings, behaviors, energy, scope]);

  const toggleBehavior = (key: string) =>
    setBehaviors((xs) => (xs.some((b) => b.key === key) ? xs.filter((b) => b.key !== key) : [...xs, { key }]));
  const setSeverity = (key: string, severity: Severity) =>
    setBehaviors((xs) => xs.map((b) => (b.key === key ? { ...b, severity } : b)));
  const setDuration = (key: string, duration: number) =>
    setBehaviors((xs) => xs.map((b) => {
      if (b.key !== key) return b;
      const { duration_min, ...rest } = b;
      return duration_min === duration ? rest : { ...rest, duration_min: duration };
    }));

  return (
    <div className="space-y-4">
      <Group label={scope === "day" ? m("dayQuestion") : m("momentQuestion", { name: activeProfile?.name ?? m("they") })}>
        <FaceScale label={m("mood")} labels={labels} value={level} onChange={setLevel} />
      </Group>

      <Group label={m("feelings")} hint={t("common.optional")}>
        <ToggleChips
          visibleCount={6}
          options={feelingOptions.map((f) => ({ value: f.key, label: f.label }))}
          selected={feelings}
          onToggle={(f) => setFeelings((xs) => (xs.includes(f) ? xs.filter((x) => x !== f) : [...xs, f]))}
        />
      </Group>

      {behaviorList.length > 0 && scope === "moment" && (
        <Group label={m("behaviors")} hint={t("common.optional")}>
          <ToggleChips
            visibleCount={5}
            options={behaviorList.map((b) => ({ value: b.key, label: b.label }))}
            selected={behaviors.map((b) => b.key)}
            onToggle={toggleBehavior}
          />
          {behaviors.map((b) => (
            <div key={b.key} className="flex flex-col gap-2 p-3 rounded-[18px] bg-secondary">
              <span className="text-label text-muted-foreground">
                {m("intensity", { name: behaviorList.find((x) => x.key === b.key)?.label ?? "" })}
              </span>
              <Segmented
                label={m("intensity", { name: behaviorList.find((x) => x.key === b.key)?.label ?? "" })}
                value={b.severity ?? null}
                onChange={(s) => setSeverity(b.key, s)}
                options={SEVERITIES.map((s) => ({ value: s.key, label: s.label }))}
              />
              <span className="text-label text-muted-foreground">{m("howLongShort")}</span>
              <RadioChips
                label={m("howLong", { name: behaviorList.find((x) => x.key === b.key)?.label ?? "" })}
                value={b.duration_min ?? null}
                onChange={(d) => setDuration(b.key, d)}
                options={BEHAVIOR_DURATIONS.map((d) => ({ value: d, label: durationLabel(d) }))}
              />
            </div>
          ))}
        </Group>
      )}

      {ctx.detailsEl &&
        createPortal(
          <Group label={m("energy")}>
            <RadioChips
              label={m("energy")}
              value={energy}
              onChange={(v) => setEnergy(v === energy ? null : v)}
              options={(["low", "normal", "high"] as const).map((v) => ({ value: v, label: t(`options.energy.${v}`) }))}
            />
          </Group>,
          ctx.detailsEl,
        )}
    </div>
  );
}
