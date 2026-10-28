"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { saveModules } from "./actions";

const ALL_MODULES = ["bathroom", "eating", "activity", "mood", "medication"] as const;

interface Props {
  profileId: string;
  careStage: "baby" | "child" | "teen_adult";
  initialModules: string[];
  step: number;
  totalSteps: number;
}

export function ModulesForm({
  profileId,
  careStage,
  initialModules,
  step,
  totalSteps,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialModules));
  const [, action, pending] = useActionState(saveModules, null);
  const t = useTranslations();

  const progress = Math.round((step / totalSteps) * 100);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });

  return (
    <form action={action} className="flex flex-col flex-1 px-5">
      <input type="hidden" name="profileId" value={profileId} />
      <input
        type="hidden"
        name="modules"
        value={JSON.stringify(Array.from(selected))}
      />

      {/* Progress */}
      <div className="pt-6 space-y-2">
        <span className="text-caption font-extrabold text-muted-foreground">
          {t("onboarding.stepOf", { step, total: totalSteps })}
        </span>
        <div
          role="progressbar"
          aria-label={t("onboarding.progress")}
          aria-valuemin={1}
          aria-valuemax={totalSteps}
          aria-valuenow={step}
          className="h-2 rounded-full bg-secondary"
        >
          <div
            className="h-2 rounded-full bg-profile"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Heading */}
      <div className="pt-5 space-y-1">
        <h1 className="font-display text-display-2">
          {t("onboarding.whatTrack")}
        </h1>
        <p className="text-body font-normal text-muted-foreground">
          {t("onboarding.prechecked", { stage: careStage })}
        </p>
      </div>


      {/* Module list */}
      <div className="flex flex-col gap-3 pt-5 flex-1">
        {ALL_MODULES.map((id) => {
          const checked = selected.has(id);
          return (
            <label
              key={id}
              className={`min-h-[60px] flex items-center gap-3 px-4 rounded-[20px] border-[1.5px] cursor-pointer transition-colors ${
                checked ? "border-profile bg-profile-tint" : "border-border bg-card"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(id)}
                className="w-[22px] h-[22px] accent-[var(--profile)]"
              />
              <span className="text-body font-extrabold">{id === "medication" ? t("modules.medications") : t(`modules.${id}`)}</span>
            </label>
          );
        })}
      </div>

      <footer className="pt-4 flex-none" style={{ paddingBottom: "calc(28px + env(safe-area-inset-bottom, 0px))" }}>
        <button
          type="submit"
          disabled={pending}
          className="w-full h-button flex items-center justify-center rounded-full bg-primary text-primary-foreground text-body-lg disabled:opacity-60"
        >
          {t("onboarding.continue")}
        </button>
      </footer>
    </form>
  );
}
