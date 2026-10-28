"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import type { ModuleFormContext } from "../LogSheet";
import { useHousehold } from "@/lib/context/household-provider";

type MoodScore = 1 | 2 | 3 | 4 | 5;
type MeltdownIntensity = "mild" | "moderate" | "severe";

const MOODS: { val: MoodScore; label: string; mouthSvg: string }[] = [
  { val: 1, label: "Very upset",  mouthSvg: '<path d="M8 17c2.4-2.6 5.6-2.6 8 0"/>' },
  { val: 2, label: "Upset",       mouthSvg: '<path d="M8.5 16.2c2.2-1.3 4.8-1.3 7 0"/>' },
  { val: 3, label: "Okay",        mouthSvg: '<path d="M8.5 15.5h7"/>' },
  { val: 4, label: "Good",        mouthSvg: '<path d="M8.5 14.5c2.2 1.6 4.8 1.6 7 0"/>' },
  { val: 5, label: "Great",       mouthSvg: '<path d="M8 13.5c2.4 3.2 5.6 3.2 8 0"/>' },
];

const FEELINGS = ["Calm", "Happy", "Tired", "Anxious", "Frustrated", "Sad"];
const FEELINGS_MORE = ["Silly", "Overwhelmed", "Excited", "Clingy", "Restless", "Content"];

const BEHAVIORS = ["Meltdown", "Tantrum", "Aggression", "Self-injury", "Running off"];
const BEHAVIORS_MORE = ["Property destruction", "Scripting", "Stimming", "Refusal", "Crying"];

const INTENSITIES: { val: MeltdownIntensity; label: string }[] = [
  { val: "mild",     label: "Mild" },
  { val: "moderate", label: "Moderate" },
  { val: "severe",   label: "Severe" },
];

const PILL_SEL = "bg-[var(--color-profile)] border-[var(--color-profile)] text-white";
const PILL_OFF = "bg-[var(--color-secondary)] border-[var(--color-border)] text-foreground";

interface Props { ctx: ModuleFormContext }

export function MoodSheet({ ctx }: Props) {
  const { profiles, activeProfileId } = useHousehold();
  const profile = profiles.find((p) => p.id === activeProfileId);
  const showBehaviors = profile?.careStage !== "baby";

  const [mood, setMood] = useState<MoodScore | null>(null);
  const [feelings, setFeelings] = useState<Set<string>>(new Set());
  const [showMoreFeelings, setShowMoreFeelings] = useState(false);
  const [behaviors, setBehaviors] = useState<Set<string>>(new Set());
  const [showMoreBehaviors, setShowMoreBehaviors] = useState(false);
  const [intensity, setIntensity] = useState<MeltdownIntensity | null>(null);

  const push = (overrides: Record<string, unknown> = {}) => {
    const m = (overrides.mood as MoodScore | null) !== undefined ? (overrides.mood as MoodScore | null) : mood;
    const f = (overrides.feelings as Set<string>) ?? feelings;
    const b = (overrides.behaviors as Set<string>) ?? behaviors;
    const i = (overrides.intensity as MeltdownIntensity | null) !== undefined ? (overrides.intensity as MeltdownIntensity | null) : intensity;
    const data: Record<string, unknown> = {};
    if (m !== null) data.score = m;
    if (f.size > 0) data.feelings = Array.from(f);
    if (b.size > 0) data.behaviors = Array.from(b);
    if (b.has("Meltdown") && i) data.meltdownIntensity = i;
    const label = MOODS.find((x) => x.val === m)?.label ?? "Mood";
    ctx.setData(data, label);
  };

  const toggleFeeling = (f: string) => {
    setFeelings((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f); else next.add(f);
      push({ feelings: next });
      return next;
    });
  };

  const toggleBehavior = (b: string) => {
    setBehaviors((prev) => {
      const next = new Set(prev);
      if (next.has(b)) next.delete(b); else next.add(b);
      push({ behaviors: next });
      return next;
    });
  };

  const allFeelings = showMoreFeelings ? [...FEELINGS, ...FEELINGS_MORE] : FEELINGS;
  const allBehaviors = showMoreBehaviors ? [...BEHAVIORS, ...BEHAVIORS_MORE] : BEHAVIORS;
  const showMeltdownIntensity = behaviors.has("Meltdown");

  return (
    <div className="space-y-4">
      {/* Mood scale (required) */}
      <div>
        <h2 className="text-[14px] font-extrabold text-muted-foreground mb-2">How are they feeling?</h2>
        <div className="flex justify-between gap-1">
          {MOODS.map(({ val, label, mouthSvg }) => {
            const sel = mood === val;
            return (
              <button
                key={val}
                type="button"
                aria-label={label}
                aria-pressed={sel}
                onClick={() => { setMood(val); push({ mood: val }); }}
                className="flex flex-col items-center gap-1 cursor-pointer"
              >
                <span
                  className={`w-[52px] h-[52px] rounded-full flex items-center justify-center transition-all ${
                    sel
                      ? "bg-[var(--color-profile)] ring-2 ring-offset-2 ring-[var(--color-profile)]"
                      : "bg-[var(--color-secondary)]"
                  }`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width={28}
                    height={28}
                    fill="none"
                    stroke={sel ? "white" : "currentColor"}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10"/>
                    <circle cx="9" cy="10" r="1.2" fill={sel ? "white" : "currentColor"} stroke="none"/>
                    <circle cx="15" cy="10" r="1.2" fill={sel ? "white" : "currentColor"} stroke="none"/>
                    <g dangerouslySetInnerHTML={{ __html: mouthSvg }} />
                  </svg>
                </span>
                <span className={`text-[11px] font-bold text-center leading-tight ${sel ? "text-[var(--color-profile)]" : "text-muted-foreground"}`}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Feelings chips */}
      <div>
        <h2 className="text-[14px] font-extrabold text-muted-foreground mb-2">Feelings</h2>
        <div className="flex flex-wrap gap-2">
          {allFeelings.map((f) => {
            const sel = feelings.has(f);
            return (
              <button
                key={f}
                type="button"
                aria-pressed={sel}
                onClick={() => toggleFeeling(f)}
                className={`min-h-[44px] px-4 flex items-center gap-1.5 rounded-full border font-bold text-[15px] cursor-pointer transition-colors ${sel ? PILL_SEL : PILL_OFF}`}
              >
                {sel && <Check size={14} strokeWidth={3} />}
                {f}
              </button>
            );
          })}
          {!showMoreFeelings && (
            <button
              type="button"
              onClick={() => setShowMoreFeelings(true)}
              className={`min-h-[44px] px-4 flex items-center gap-1.5 rounded-full border-[1.5px] border-dashed font-bold text-[15px] cursor-pointer ${PILL_OFF}`}
            >
              More ▾
            </button>
          )}
        </div>
      </div>

      {/* Notable behaviors (child/teen_adult only) */}
      {showBehaviors && (
        <div>
          <h2 className="text-[14px] font-extrabold text-muted-foreground mb-2">Notable behaviors</h2>
          <div className="flex flex-wrap gap-2">
            {allBehaviors.map((b) => {
              const sel = behaviors.has(b);
              return (
                <button
                  key={b}
                  type="button"
                  aria-pressed={sel}
                  onClick={() => toggleBehavior(b)}
                  className={`min-h-[44px] px-4 flex items-center gap-1.5 rounded-full border font-bold text-[15px] cursor-pointer transition-colors ${sel ? PILL_SEL : PILL_OFF}`}
                >
                  {sel && <Check size={14} strokeWidth={3} />}
                  {b}
                </button>
              );
            })}
            {!showMoreBehaviors && (
              <button
                type="button"
                onClick={() => setShowMoreBehaviors(true)}
                className={`min-h-[44px] px-4 flex items-center gap-1.5 rounded-full border-[1.5px] border-dashed font-bold text-[15px] cursor-pointer ${PILL_OFF}`}
              >
                More ▾
              </button>
            )}
          </div>

          {/* Meltdown intensity sub-group */}
          {showMeltdownIntensity && (
            <div className="mt-3 p-3 rounded-[18px] bg-[var(--color-secondary)]">
              <h3 className="text-[13px] font-extrabold text-muted-foreground mb-2">Meltdown intensity</h3>
              <div className="flex gap-1.5">
                {INTENSITIES.map(({ val, label }) => {
                  const sel = intensity === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      aria-pressed={sel}
                      onClick={() => { setIntensity(val); push({ intensity: val }); }}
                      className={`flex-1 min-h-[44px] flex items-center justify-center rounded-full border font-extrabold text-[14px] cursor-pointer transition-colors ${sel ? PILL_SEL : "bg-[var(--color-card)] border-[var(--color-border)] text-foreground"}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
