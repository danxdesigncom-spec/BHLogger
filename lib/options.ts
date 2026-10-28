// Option sets and care-stage wording from PRD Appendix A.
// Keys are the values stored in entries.data; labels are display copy.

import type { CareStage, Toileting } from "@/lib/supabase/types";

export interface Option<K extends string = string> {
  key: K;
  label: string;
}

export function humanize(key: string): string {
  const s = key.replace(/^opt_/, "").replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function labelFor(options: readonly Option[], key: string): string {
  return options.find((o) => o.key === key)?.label ?? humanize(key);
}

// ─── Bathroom ────────────────────────────────────────────────────────────────

export type BathroomKind = "pee" | "bm" | "both" | "dry";

export function bathroomTileLabel(stage: CareStage, toileting: Toileting): string {
  if (stage === "baby") return "Diaper";
  if (stage === "child" && toileting === "diapers") return "Diaper";
  if (stage === "child" && toileting === "training") return "Potty";
  return "Bathroom";
}

/** Diaper users see Wet/Dirty; everyone else sees Pee/BM (Appendix A, mockup S20). */
export function bathroomKindLabel(kind: BathroomKind, toileting: Toileting): string {
  const diaper = toileting === "diapers";
  switch (kind) {
    case "pee":  return diaper ? "Wet" : "Pee";
    case "bm":   return diaper ? "Dirty" : "BM";
    case "both": return "Both";
    case "dry":  return "Dry";
  }
}

export function bathroomKinds(toileting: Toileting): BathroomKind[] {
  // BTH-01: Dry only for diaper and toilet-training profiles
  return toileting === "toilet" ? ["pee", "bm", "both"] : ["pee", "bm", "both", "dry"];
}

export function absorbentLabel(stage: CareStage, toileting: Toileting): string {
  if (stage === "teen_adult") return "Brief";
  if (stage === "child" && toileting !== "diapers") return "Pull-up";
  return "Diaper";
}

/** BTH-03: infant 4-point for babies and children in diapers; Bristol otherwise. */
export function defaultStoolScale(stage: CareStage, toileting: Toileting): "aiss" | "bristol" {
  if (stage === "teen_adult") return "bristol";
  return toileting === "diapers" ? "aiss" : "bristol";
}

export const INFANT_CONSISTENCY = [
  { key: "watery", label: "Watery" },
  { key: "soft",   label: "Soft" },
  { key: "formed", label: "Formed" },
  { key: "hard",   label: "Hard" },
] as const satisfies readonly Option[];

export const BRISTOL = [
  { type: 1, short: "Hard lumps", full: "Separate hard lumps" },
  { type: 2, short: "Lumpy",      full: "Lumpy, sausage-shaped" },
  { type: 3, short: "Cracked",    full: "Sausage with surface cracks" },
  { type: 4, short: "Smooth",     full: "Smooth, soft sausage" },
  { type: 5, short: "Soft blobs", full: "Soft blobs with clear edges" },
  { type: 6, short: "Mushy",      full: "Mushy, ragged pieces" },
  { type: 7, short: "Watery",     full: "Watery, no solid pieces" },
] as const;

export const STOOL_COLORS = [
  { key: "yellow",          label: "Yellow" },
  { key: "green",           label: "Green" },
  { key: "brown",           label: "Brown" },
  { key: "black",           label: "Black" },
  { key: "red",             label: "Red" },
  { key: "white_pale_clay", label: "Pale" },
  { key: "other",           label: "Other" },
] as const satisfies readonly Option[];

export const BM_SIZES = [
  { key: "small",  label: "Small" },
  { key: "medium", label: "Medium" },
  { key: "large",  label: "Large" },
] as const satisfies readonly Option[];

export const BM_FLAGS = [
  { key: "straining_pain", label: "Straining/pain" },
  { key: "blood",          label: "Blood" },
  { key: "mucus",          label: "Mucus" },
  { key: "diaper_rash",    label: "Diaper rash" },
  { key: "blowout_leak",   label: "Blowout/leak" },
] as const satisfies readonly Option[];

/** BTH-06: red, white/pale/clay, and black after the first week of life. */
export function isNoticeColor(color: string | undefined, ageDays: number | null): boolean {
  if (color === "red" || color === "white_pale_clay") return true;
  if (color === "black") return ageDays === null || ageDays > 7;
  return false;
}

// ─── Eating ──────────────────────────────────────────────────────────────────

export type EatingMethod = "breast" | "bottle" | "meal" | "snack" | "drink";

export function eatingMethods(stage: CareStage, feedingMethods: string[], ageMonths: number | null): EatingMethod[] {
  const allowed: EatingMethod[] = ["breast", "bottle", "meal", "snack", "drink"];
  const fromProfile = feedingMethods.filter((m): m is EatingMethod => (allowed as string[]).includes(m));
  if (fromProfile.length > 0) return fromProfile;
  if (stage === "baby") {
    return ageMonths !== null && ageMonths >= 6 ? ["breast", "bottle", "meal", "snack"] : ["breast", "bottle"];
  }
  return ["meal", "snack", "drink"];
}

export function eatingMethodLabel(method: string, stage: CareStage): string {
  if (method === "meal" && stage === "baby") return "Solids";
  return humanize(method);
}

export const BREAST_SIDES = [
  { key: "left",  label: "Left" },
  { key: "right", label: "Right" },
  { key: "both",  label: "Both" },
] as const satisfies readonly Option[];

export const BREAST_DURATIONS = [5, 10, 15, 20, 30] as const;

export const BOTTLE_CONTENTS = [
  { key: "breast_milk", label: "Breast milk" },
  { key: "formula",     label: "Formula" },
  { key: "other",       label: "Other" },
] as const satisfies readonly Option[];

export const OZ_CHIPS = [1, 2, 3, 4, 5, 6, 8] as const;
export const ML_CHIPS = [30, 60, 90, 120, 150, 180, 240] as const;
export const ML_PER_OZ = 29.5735;

export function mlToOz(ml: number): number {
  return Math.round((ml / ML_PER_OZ) * 2) / 2;
}
export function ozToMl(oz: number): number {
  return Math.round(oz * ML_PER_OZ);
}
export function formatVolume(ml: number, unit: "ml" | "oz"): string {
  return unit === "oz" ? `${mlToOz(ml)} oz` : `${Math.round(ml)} ml`;
}

export const MEAL_TYPES = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch",     label: "Lunch" },
  { key: "dinner",    label: "Dinner" },
] as const satisfies readonly Option[];

export function mealTypeForHour(hour: number): "breakfast" | "lunch" | "dinner" {
  if (hour < 11) return "breakfast";
  if (hour < 16) return "lunch";
  return "dinner";
}

export const PORTIONS = [
  { pct: 0,   label: "None" },
  { pct: 25,  label: "A little" },
  { pct: 50,  label: "Half" },
  { pct: 75,  label: "Most" },
  { pct: 100, label: "All" },
] as const;

export function portionLabel(pct: number): string {
  return PORTIONS.find((p) => p.pct === pct)?.label ?? `${pct}%`;
}

export const DRINKS = [
  { key: "water", label: "Water" },
  { key: "milk",  label: "Milk" },
  { key: "juice", label: "Juice" },
  { key: "other", label: "Other" },
] as const satisfies readonly Option[];

export const REACTIONS = [
  { key: "refused",           label: "Refused" },
  { key: "gagged",            label: "Gagged" },
  { key: "vomited",           label: "Vomited/spit up" },
  { key: "rash_hives",        label: "Rash/hives" },
  { key: "fussy",             label: "Fussy" },
  { key: "coughing_choking",  label: "Coughing/choking" },
  { key: "trouble_breathing", label: "Trouble breathing or swelling" },
] as const satisfies readonly Option[];

/** EAT-06: only this reaction shows the 911 notice. */
export const URGENT_REACTION = "trouble_breathing";

export const FOOD_GROUPS = [
  { key: "fruit",         label: "Fruit" },
  { key: "vegetables",    label: "Vegetables" },
  { key: "grains",        label: "Grains" },
  { key: "protein",       label: "Protein" },
  { key: "dairy",         label: "Dairy" },
  { key: "sweets_snacks", label: "Sweets/snacks" },
] as const satisfies readonly Option[];

// ─── Activity ────────────────────────────────────────────────────────────────

export const ACTIVITY_LIBRARY: Record<CareStage, Option[]> = {
  baby: [
    { key: "tummy_time",   label: "Tummy time" },
    { key: "bath",         label: "Bath" },
    { key: "reading",      label: "Books" },
    { key: "music",        label: "Music/singing" },
    { key: "walk",         label: "Walk/stroller" },
    { key: "play_mat",     label: "Play mat" },
    { key: "skin_to_skin", label: "Skin-to-skin" },
    { key: "outside_time", label: "Outside time" },
  ],
  child: [
    { key: "playground",    label: "Playground" },
    { key: "music",         label: "Music" },
    { key: "reading",       label: "Books" },
    { key: "screen_time",   label: "Screen time" },
    { key: "sensory_play",  label: "Sensory play" },
    { key: "swimming",      label: "Swimming" },
    { key: "building_toys", label: "Building toys" },
    { key: "therapy",       label: "Therapy" },
    { key: "outdoor_play",  label: "Outdoor play" },
    { key: "art",           label: "Arts and crafts" },
    { key: "video_games",   label: "Video games" },
    { key: "pretend_play",  label: "Pretend play" },
    { key: "sports",        label: "Sports" },
    { key: "playdate",      label: "Playdate" },
    { key: "school",        label: "School" },
  ],
  teen_adult: [
    { key: "walk",             label: "Walk" },
    { key: "music",            label: "Music" },
    { key: "tv_movies",        label: "TV/movies" },
    { key: "games",            label: "Games" },
    { key: "art",              label: "Art" },
    { key: "cooking",          label: "Cooking" },
    { key: "exercise",         label: "Exercise" },
    { key: "social_outing",    label: "Social outing" },
    { key: "community_outing", label: "Community outing" },
    { key: "day_program",      label: "Day program" },
    { key: "work_volunteer",   label: "Work/volunteer" },
    { key: "therapy",          label: "Therapy session" },
  ],
};

export function activityLabel(key: string, custom: Option[] = []): string {
  const all = [...custom, ...ACTIVITY_LIBRARY.child, ...ACTIVITY_LIBRARY.baby, ...ACTIVITY_LIBRARY.teen_adult];
  return labelFor(all, key);
}

export const ENJOYMENT_LABELS = ["Disliked", "Not into it", "Okay", "Enjoyed", "Loved it"] as const;
export const ACTIVITY_DURATIONS = [
  { min: 5,  label: "5 min" },
  { min: 15, label: "15 min" },
  { min: 30, label: "30 min" },
  { min: 60, label: "1 hour" },
  { min: 90, label: "90+ min" },
] as const;

// ─── Mood ────────────────────────────────────────────────────────────────────

export function moodLabels(stage: CareStage): readonly string[] {
  return stage === "baby"
    ? ["Inconsolable", "Fussy", "Settled", "Content", "Happy"]
    : ["Very upset", "Upset", "Okay", "Good", "Great"];
}

export const FEELINGS: Record<CareStage, Option[]> = {
  baby: [
    { key: "fussy",        label: "Fussy" },
    { key: "crying_a_lot", label: "Crying a lot" },
    { key: "sleepy",       label: "Sleepy" },
    { key: "alert",        label: "Alert" },
    { key: "calm",         label: "Calm" },
    { key: "gassy",        label: "Gassy" },
    { key: "teething",     label: "Teething" },
  ],
  child: [
    { key: "calm",        label: "Calm" },
    { key: "happy",       label: "Happy" },
    { key: "tired",       label: "Tired" },
    { key: "anxious",     label: "Anxious" },
    { key: "frustrated",  label: "Frustrated" },
    { key: "sad",         label: "Sad" },
    { key: "silly",       label: "Silly" },
    { key: "excited",     label: "Excited" },
    { key: "angry",       label: "Angry" },
    { key: "overwhelmed", label: "Overwhelmed" },
    { key: "sick",        label: "Sick" },
    { key: "in_pain",     label: "In pain" },
  ],
  teen_adult: [
    { key: "calm",        label: "Calm" },
    { key: "happy",       label: "Happy" },
    { key: "tired",       label: "Tired" },
    { key: "anxious",     label: "Anxious" },
    { key: "frustrated",  label: "Frustrated" },
    { key: "sad",         label: "Sad" },
    { key: "playful",     label: "Playful" },
    { key: "excited",     label: "Excited" },
    { key: "angry",       label: "Angry" },
    { key: "overwhelmed", label: "Overwhelmed" },
    { key: "sick",        label: "Sick" },
    { key: "in_pain",     label: "In pain" },
  ],
};

const ALL_BEHAVIORS: Option[] = [
  { key: "meltdown",           label: "Meltdown" },
  { key: "tantrum",            label: "Tantrum" },
  { key: "aggression",         label: "Aggression" },
  { key: "self_injury",        label: "Self-injury" },
  { key: "running_off",        label: "Running off" },
  { key: "increased_stimming", label: "Increased stimming" },
  { key: "withdrawn",          label: "Withdrawn" },
  { key: "transitions",        label: "Trouble with transitions" },
  { key: "crying_spells",      label: "Crying spells" },
];

export function behaviors(stage: CareStage): Option[] {
  if (stage === "baby") return [];
  if (stage === "teen_adult") return ALL_BEHAVIORS.filter((b) => b.key !== "tantrum");
  return ALL_BEHAVIORS;
}

export function behaviorLabel(key: string): string {
  return labelFor(ALL_BEHAVIORS, key);
}

export function feelingLabel(key: string): string {
  return labelFor([...FEELINGS.baby, ...FEELINGS.child, ...FEELINGS.teen_adult], key);
}

export const SEVERITIES = [
  { key: "mild",     label: "Mild" },
  { key: "moderate", label: "Moderate" },
  { key: "severe",   label: "Severe" },
] as const satisfies readonly Option[];

// ─── Medication ──────────────────────────────────────────────────────────────

export const MED_FORMS = [
  "Liquid", "Tablet", "Capsule", "Chewable", "Dissolving tablet", "Drops", "Inhaler", "Nebulizer",
  "Cream/ointment", "Patch", "Injection", "Suppository", "Powder", "Other",
] as const;

export const DOSE_UNITS = [
  "mL", "mg", "mcg", "tablet", "capsule", "drop", "puff", "spray", "application", "unit", "scoop", "other",
] as const;

export const DOSE_OUTCOMES = [
  { key: "given",           label: "Given" },
  { key: "partial",         label: "Partial" },
  { key: "refused",         label: "Refused" },
  { key: "spit_up_vomited", label: "Spit up/vomited" },
  { key: "skipped",         label: "Skipped" },
] as const satisfies readonly Option[];

export const PRN_REASONS = [
  { key: "fever",       label: "Fever" },
  { key: "pain",        label: "Pain" },
  { key: "agitation",   label: "Agitation/anxiety" },
  { key: "sleep",       label: "Sleep" },
  { key: "cough_cold",  label: "Cough/cold" },
  { key: "allergy",     label: "Allergy" },
  { key: "constipation", label: "Constipation" },
  { key: "other",       label: "Other" },
] as const satisfies readonly Option[];

export const PRN_FOLLOWUPS = [
  { key: "helped",     label: "Helped" },
  { key: "somewhat",   label: "Somewhat" },
  { key: "didnt_help", label: "Didn't help" },
] as const satisfies readonly Option[];

export function formatDose(dose: number, unit: string): string {
  const n = Number.isInteger(dose) ? String(dose) : String(Math.round(dose * 100) / 100);
  return `${n} ${unit}`;
}

// ─── Ages ────────────────────────────────────────────────────────────────────

export function ageInDays(dob: string | null, at = new Date()): number | null {
  if (!dob) return null;
  const d = new Date(`${dob}T00:00:00`);
  return Math.floor((at.getTime() - d.getTime()) / 86_400_000);
}

export function ageInMonths(dob: string | null, at = new Date()): number | null {
  if (!dob) return null;
  const d = new Date(`${dob}T00:00:00`);
  let months = (at.getFullYear() - d.getFullYear()) * 12 + (at.getMonth() - d.getMonth());
  if (at.getDate() < d.getDate()) months -= 1;
  return months;
}

export function ageLabel(dob: string | null, at = new Date()): string | null {
  const months = ageInMonths(dob, at);
  if (months === null) return null;
  if (months < 24) return `${months} month${months === 1 ? "" : "s"}`;
  const years = Math.floor(months / 12);
  return `${years} years`;
}
