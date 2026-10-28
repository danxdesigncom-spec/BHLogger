"use client";

import { useActionState, useState } from "react";
import { Calendar, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { submitProfileStep } from "./actions";
import type { ProfileColor } from "@/lib/supabase/types";

const COLORS: ProfileColor[] = ["violet", "teal", "rose", "amber", "blue"];
const STAGES: Stage[] = ["baby", "child", "teen_adult"];
const TOILETING: Toileting[] = ["diapers", "training", "toilet"];

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
  const t = useTranslations();
  const o = (k: string, v?: Record<string, string | number>) => t(`onboarding.${k}`, v);

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
        <span className="text-caption font-extrabold text-muted-foreground">
          {o("stepOf", { step, total: totalSteps })}
        </span>
        <div
          role="progressbar"
          aria-label={o("progress")}
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
      <div className="pt-5 pb-0 space-y-1">
        <h1 className="font-display text-display-2">
          {o("who")}
        </h1>
        <p className="text-body font-normal text-muted-foreground">
          {o("addLater")}
        </p>
      </div>

      {/* Form fields */}
      <div className="flex flex-col gap-4 pt-5 flex-1 overflow-y-auto pb-4">
        {state?.error && (
          <p role="alert" className="rounded-lg border border-flag-border bg-flag px-4 py-3 text-label font-bold text-flag-ink">
            {state.error}
          </p>
        )}

        {/* Name */}
        <div className="space-y-2">
          <label htmlFor="name" className="block text-label font-extrabold text-muted-foreground">
            {o("name")}
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            autoFocus
            className="w-full h-button rounded-lg border-[1.5px] border-input bg-card px-4 text-[16px] font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>

        {/* Age group */}
        <fieldset>
          <legend className="text-label font-extrabold text-muted-foreground mb-2">{o("ageGroup")}</legend>
          <div className="space-y-2">
            {STAGES.map((value) => (
              <label
                key={value}
                className={`min-h-[64px] flex items-center gap-3 px-4 rounded-[20px] border-[1.5px] cursor-pointer ${
                  stage === value ? "border-profile bg-profile-tint" : "border-border bg-card"
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
                  className="w-[22px] h-[22px] accent-[var(--profile)]"
                />
                <span className="flex flex-col gap-[2px]">
                  <span className="text-body font-extrabold">{o(`stage.${value}.label`)}</span>
                  <span className="text-caption text-muted-foreground">{o(`stage.${value}.desc`)}</span>
                </span>
              </label>
            ))}
            <button
              type="button"
              onClick={() => setShowBirthday((v) => !v)}
              className="flex items-center gap-1.5 min-h-touch-min text-label font-extrabold text-profile-ink pl-1"
            >
              <Calendar size={18} strokeWidth={2} aria-hidden="true" />
              {o("addBirthday")}
            </button>
            {showBirthday && (
              <input
                name="dob"
                type="date"
                aria-label={t("profileSettings.birthday")}
                className="w-full h-button rounded-lg border-[1.5px] border-input bg-card px-4 text-[16px] font-bold focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            )}
          </div>
        </fieldset>

        {/* Bathroom */}
        <div className="space-y-2">
          <span id="bath-label" className="block text-label font-extrabold text-muted-foreground">
            {o("bathroom")}
          </span>
          <div role="group" aria-labelledby="bath-label" className="flex flex-wrap gap-2">
            {TOILETING.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={toileting === value}
                onClick={() => setToileting(value)}
                className={`min-h-touch-min flex items-center gap-1.5 px-4 rounded-full text-body border transition-colors ${
                  toileting === value
                    ? "border-profile bg-profile text-on-profile font-extrabold"
                    : "border-border bg-secondary text-foreground"
                }`}
              >
                {toileting === value && <Check size={16} strokeWidth={2.5} aria-hidden="true" />}
                {value === "diapers" && stage === "teen_adult" ? t("options.toileting.briefs") : o(`toileting.${value}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Profile color */}
        <div className="space-y-2">
          <span id="color-label" className="block text-label font-extrabold text-muted-foreground">
            {o("color")}
          </span>
          <div role="group" aria-labelledby="color-label" className="flex gap-3">
            {COLORS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={color === value}
                aria-label={t(`options.color.${value}`)}
                onClick={() => setColor(value)}
                data-profile-color={value}
                className="w-11 h-11 rounded-full bg-profile text-on-profile flex items-center justify-center"
                style={color === value ? { boxShadow: "0 0 0 3px var(--background), 0 0 0 5px var(--foreground)" } : undefined}
              >
                {color === value && (
                  <Check size={18} strokeWidth={3} aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="pt-3 flex-none" style={{ paddingBottom: "calc(28px + env(safe-area-inset-bottom, 0px))" }}>
        <button
          type="submit"
          disabled={pending}
          className="w-full h-button flex items-center justify-center rounded-full bg-primary text-primary-foreground text-body-lg disabled:opacity-60"
        >
          {o("continue")}
        </button>
      </footer>
    </form>
  );
}
