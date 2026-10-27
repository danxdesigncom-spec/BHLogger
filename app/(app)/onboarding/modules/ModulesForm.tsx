"use client";

import { useActionState, useState } from "react";
import { saveModules } from "./actions";

const ALL_MODULES = [
  { id: "bathroom",   label: "Bathroom" },
  { id: "eating",     label: "Eating" },
  { id: "activity",   label: "Activity" },
  { id: "mood",       label: "Mood" },
  { id: "medication", label: "Medications" },
];

interface Props {
  profileId: string;
  careStage: "baby" | "child" | "teen_adult";
  initialModules: string[];
  step: number;
  totalSteps: number;
}

const STAGE_LABELS = {
  baby: "babies",
  child: "children",
  teen_adult: "teens and adults",
};

export function ModulesForm({
  profileId,
  careStage,
  initialModules,
  step,
  totalSteps,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialModules));
  const [, action, pending] = useActionState(saveModules, null);

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
        <span className="text-[13px] font-extrabold text-muted-foreground">
          Step {step} of {totalSteps}
        </span>
        <div
          role="progressbar"
          aria-label="Setup progress"
          aria-valuemin={1}
          aria-valuemax={totalSteps}
          aria-valuenow={step}
          className="h-2 rounded-full bg-[var(--color-border)]"
        >
          <div
            className="h-2 rounded-full bg-[var(--color-profile)]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Heading */}
      <div className="pt-5 space-y-1">
        <h1 className="font-display text-[30px] font-semibold leading-tight">
          What do you track?
        </h1>
        <p className="text-sm text-muted-foreground">
          Pre-checked for {STAGE_LABELS[careStage]}. You can change these anytime.
        </p>
      </div>


      {/* Module list */}
      <div className="flex flex-col gap-3 pt-5 flex-1">
        {ALL_MODULES.map(({ id, label }) => {
          const checked = selected.has(id);
          return (
            <label
              key={id}
              className={`min-h-[60px] flex items-center gap-3 px-4 rounded-[20px] border-[1.5px] cursor-pointer transition-colors ${
                checked
                  ? "border-[var(--color-profile)] bg-[var(--color-profile-bg)]"
                  : "border-[var(--color-border)] bg-white"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(id)}
                className="w-[22px] h-[22px] accent-[var(--color-profile)]"
              />
              <span className="text-base font-extrabold">{label}</span>
            </label>
          );
        })}
      </div>

      <footer className="pb-7 pt-4 flex-none">
        <button
          type="submit"
          disabled={pending}
          className="w-full min-h-[52px] flex items-center justify-center rounded-full bg-foreground text-background text-[17px] font-extrabold disabled:opacity-60"
        >
          Continue
        </button>
      </footer>
    </form>
  );
}
