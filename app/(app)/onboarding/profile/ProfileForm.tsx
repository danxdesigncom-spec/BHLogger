"use client";

import { useActionState, useState } from "react";
import { Calendar, Check } from "lucide-react";
import { submitProfileStep } from "./actions";
import type { ProfileColor } from "@/lib/supabase/types";

const COLORS: { value: ProfileColor; label: string; bg: string }[] = [
  { value: "violet", label: "Violet", bg: "bg-[var(--color-profile-violet)]" },
  { value: "teal",   label: "Teal",   bg: "bg-[var(--color-profile-teal)]" },
  { value: "rose",   label: "Rose",   bg: "bg-[var(--color-profile-rose)]" },
  { value: "amber",  label: "Amber",  bg: "bg-[var(--color-profile-amber)]" },
  { value: "blue",   label: "Blue",   bg: "bg-[var(--color-profile-blue)]" },
];

type Stage = "baby" | "child" | "teen_adult";
type Toileting = "diapers" | "training" | "toilet";

interface Props {
  householdId: string | null;
  initialDisplayName: string;
  householdName?: string;
  step: number;
  totalSteps: number;
}

export function ProfileForm({
  householdId,
  initialDisplayName,
  householdName,
  step,
  totalSteps,
}: Props) {
  const [stage, setStage] = useState<Stage>("child");
  const [toileting, setToileting] = useState<Toileting>("toilet");
  const [color, setColor] = useState<ProfileColor>("violet");
  const [showBirthday, setShowBirthday] = useState(false);

  const [state, action, pending] = useActionState(submitProfileStep, null);

  const progress = Math.round((step / totalSteps) * 100);

  return (
    <form action={action} className="flex flex-col flex-1 px-5">
      <input type="hidden" name="householdId" value={householdId ?? ""} />
      <input type="hidden" name="careStage" value={stage} />
      <input type="hidden" name="toileting" value={toileting} />
      <input type="hidden" name="color" value={color} />
      <input type="hidden" name="displayName" value={initialDisplayName} />
      <input type="hidden" name="householdName" value={householdName ?? ""} />

      {/* Progress */}
      <div className="pt-6 pb-0 space-y-2">
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
      <div className="pt-5 pb-0 space-y-1">
        <h1 className="font-display text-[30px] font-semibold leading-tight">
          Who are you caring for?
        </h1>
        <p className="text-sm text-muted-foreground">
          You can add more people later.
        </p>
      </div>

      {/* Form fields */}
      <div className="flex flex-col gap-4 pt-5 flex-1 overflow-y-auto pb-4">
        {state?.error && (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.error}
          </p>
        )}

        {/* Name */}
        <div className="space-y-2">
          <label htmlFor="name" className="block text-sm font-extrabold text-muted-foreground">
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            autoFocus
            className="w-full min-h-[52px] rounded-2xl border-[1.5px] border-[var(--color-border)] bg-white px-4 text-[17px] font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--color-profile)]"
          />
        </div>

        {/* Age group */}
        <fieldset>
          <legend className="text-sm font-extrabold text-muted-foreground mb-2">Age group</legend>
          <div className="space-y-2">
            {(
              [
                { value: "baby", label: "Baby", desc: "Up to 12 months · diapers and feeds" },
                { value: "child", label: "Child", desc: "1 to 12 years" },
                { value: "teen_adult", label: "Teen or adult", desc: "13 and up" },
              ] as { value: Stage; label: string; desc: string }[]
            ).map(({ value, label, desc }) => (
              <label
                key={value}
                className={`min-h-[64px] flex items-center gap-3 px-4 rounded-[20px] border-[1.5px] cursor-pointer ${
                  stage === value
                    ? "border-[var(--color-profile)] bg-[var(--color-profile-bg)]"
                    : "border-[var(--color-border)] bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="stageVisual"
                  value={value}
                  checked={stage === value}
                  onChange={() => {
                    setStage(value);
                    if (value === "baby") setToileting("diapers");
                    else if (value === "child") setToileting("toilet");
                    else setToileting("toilet");
                  }}
                  className="w-[22px] h-[22px] accent-[var(--color-profile)]"
                />
                <span className="flex flex-col gap-[2px]">
                  <span className="text-base font-extrabold">{label}</span>
                  <span className="text-[13px] text-muted-foreground">{desc}</span>
                </span>
              </label>
            ))}
            <button
              type="button"
              onClick={() => setShowBirthday((v) => !v)}
              className="flex items-center gap-1.5 min-h-[44px] text-sm font-extrabold text-[var(--color-profile)] pl-1"
            >
              <Calendar size={18} strokeWidth={2} />
              Add a birthday instead (optional)
            </button>
            {showBirthday && (
              <input
                name="dob"
                type="date"
                className="w-full min-h-[52px] rounded-2xl border-[1.5px] border-[var(--color-border)] bg-white px-4 text-base font-bold focus:outline-none focus:ring-2 focus:ring-[var(--color-profile)]"
              />
            )}
          </div>
        </fieldset>

        {/* Bathroom */}
        <div className="space-y-2">
          <span id="bath-label" className="block text-sm font-extrabold text-muted-foreground">
            Bathroom
          </span>
          <div role="group" aria-labelledby="bath-label" className="flex flex-wrap gap-2">
            {(
              [
                { value: "diapers", label: "Diapers" },
                { value: "training", label: "Learning" },
                { value: "toilet", label: "Uses the toilet" },
              ] as { value: Toileting; label: string }[]
            ).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                aria-pressed={toileting === value}
                onClick={() => setToileting(value)}
                className={`min-h-[44px] flex items-center gap-1.5 px-4 rounded-full text-[15px] font-bold border transition-colors ${
                  toileting === value
                    ? "border-[var(--color-profile)] bg-[var(--color-profile)] text-white"
                    : "border-[var(--color-border)] bg-white text-foreground"
                }`}
              >
                {toileting === value && <Check size={16} strokeWidth={2} />}
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Profile color */}
        <div className="space-y-2">
          <span id="color-label" className="block text-sm font-extrabold text-muted-foreground">
            Profile color
          </span>
          <div role="group" aria-labelledby="color-label" className="flex gap-3">
            {COLORS.map(({ value, label, bg }) => (
              <button
                key={value}
                type="button"
                aria-pressed={color === value}
                aria-label={label}
                onClick={() => setColor(value)}
                className={`w-11 h-11 rounded-full ${bg} flex items-center justify-center transition-shadow ${
                  color === value
                    ? "ring-2 ring-offset-2 ring-offset-[var(--color-surface)] ring-foreground"
                    : ""
                }`}
              >
                {color === value && (
                  <Check size={18} strokeWidth={2} className="text-white" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="pb-7 pt-3 flex-none">
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
