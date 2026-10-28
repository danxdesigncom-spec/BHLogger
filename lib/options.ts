// Option sets and care-stage wording from PRD Appendix A. Keys are the values stored in entries.data;
// labels come from messages (options.*) so every string is translatable (SET-08).

import type { CareStage, Toileting } from "@/lib/supabase/types";
import { has, t } from "@/lib/i18n";

export interface Option<K extends string = string> {
  key: K;
  label: string;
}

/** An option whose label is read from messages at use time, so a locale change applies everywhere. */
function opt<K extends string>(key: K, messageKey: string): Option<K> {
  return { key, get label() { return t(messageKey); } };
}
const set = <K extends string>(ns: string, keys: readonly K[]) => keys.map((k) => opt(k, `options.${ns}.${k}`));

export function humanize(key: string): string {
  const s = key.replace(/^opt_/, "").replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function labelFor(options: readonly Option[], key: string): string {
  return options.find((o) => o.key === key)?.label ?? humanize(key);
}

/** Label for a stored key: the built-in message if there is one, otherwise the key itself (custom options). */
function messageOr(ns: string, key: string): string {
  return has(`options.${ns}.${key}`) ? t(`options.${ns}.${key}`) : humanize(key);
}

// ─── Bathroom ────────────────────────────────────────────────────────────────

export type BathroomKind = "pee" | "bm" | "both" | "dry";

export function bathroomTileLabel(stage: CareStage, toileting: Toileting): string {
  if (stage === "baby") return t("options.bathroomTile.diaper");
  if (stage === "child" && toileting === "diapers") return t("options.bathroomTile.diaper");
  if (stage === "child" && toileting === "training") return t("options.bathroomTile.potty");
  return t("options.bathroomTile.bathroom");
}

/** Diaper users see Wet/Dirty; everyone else sees Pee/BM (Appendix A, mockup S20). */
export function bathroomKindLabel(kind: BathroomKind, toileting: Toileting): string {
  const diaper = toileting === "diapers";
  if (kind === "pee" && diaper) return t("options.bathroomKind.wet");
  if (kind === "bm" && diaper) return t("options.bathroomKind.dirty");
  return t(`options.bathroomKind.${kind}`);
}

export function bathroomKinds(toileting: Toileting): BathroomKind[] {
  // BTH-01: Dry only for diaper and toilet-training profiles
  return toileting === "toilet" ? ["pee", "bm", "both"] : ["pee", "bm", "both", "dry"];
}

export function absorbentLabel(stage: CareStage, toileting: Toileting): string {
  if (stage === "teen_adult") return t("options.absorbent.brief");
  if (stage === "child" && toileting !== "diapers") return t("options.absorbent.pullUp");
  return t("options.absorbent.diaper");
}

/** BTH-03: infant 4-point for babies and children in diapers; Bristol otherwise. */
export function defaultStoolScale(stage: CareStage, toileting: Toileting): "aiss" | "bristol" {
  if (stage === "teen_adult") return "bristol";
  return toileting === "diapers" ? "aiss" : "bristol";
}

export const INFANT_CONSISTENCY = set("infantConsistency", ["watery", "soft", "formed", "hard"] as const);

export const BRISTOL = ([1, 2, 3, 4, 5, 6, 7] as const).map((type) => ({
  type,
  get short() { return t(`options.bristolShort.${type}`); },
  get full() { return t(`options.bristolFull.${type}`); },
}));

export const STOOL_COLORS = set("stoolColor", ["yellow", "green", "brown", "black", "red", "white_pale_clay", "other"] as const);
export const BM_SIZES = set("bmSize", ["small", "medium", "large"] as const);
export const BM_FLAGS = set("bmFlag", ["straining_pain", "blood", "mucus", "diaper_rash", "blowout_leak"] as const);

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
  if (method === "meal" && stage === "baby") return t("options.eatingMethod.solids");
  return messageOr("eatingMethod", method);
}

export const BREAST_SIDES = set("breastSide", ["left", "right", "both"] as const);
export const BREAST_DURATIONS = [5, 10, 15, 20, 30] as const;
export const BOTTLE_CONTENTS = set("bottleContents", ["breast_milk", "formula", "other"] as const);

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

export const MEAL_TYPES = set("mealType", ["breakfast", "lunch", "dinner"] as const);

export function mealTypeForHour(hour: number): "breakfast" | "lunch" | "dinner" {
  if (hour < 11) return "breakfast";
  if (hour < 16) return "lunch";
  return "dinner";
}

export const PORTIONS = ([0, 25, 50, 75, 100] as const).map((pct) => ({ pct, get label() { return t(`options.portion.${pct}`); } }));

export function portionLabel(pct: number): string {
  return PORTIONS.find((p) => p.pct === pct)?.label ?? `${pct}%`;
}

export const DRINKS = set("drink", ["water", "milk", "juice", "other"] as const);
export const REACTIONS = set("reaction", ["refused", "gagged", "vomited", "rash_hives", "fussy", "coughing_choking", "trouble_breathing"] as const);

/** EAT-06: only this reaction shows the 911 notice. */
export const URGENT_REACTION = "trouble_breathing";

export const FOOD_GROUPS = set("foodGroup", ["fruit", "vegetables", "grains", "protein", "dairy", "sweets_snacks"] as const);

// ─── Activity ────────────────────────────────────────────────────────────────

const act = (key: string, messageKey = key) => opt(key, `options.activity.${messageKey}`);

export const ACTIVITY_LIBRARY: Record<CareStage, Option[]> = {
  baby: [
    act("tummy_time"), act("bath"), act("reading"), act("music", "music_singing"), act("walk", "walk_stroller"),
    act("play_mat"), act("skin_to_skin"), act("outside_time"),
  ],
  child: [
    act("playground"), act("music"), act("reading"), act("screen_time"), act("sensory_play"), act("swimming"),
    act("building_toys"), act("therapy"), act("outdoor_play"), act("art"), act("video_games"), act("pretend_play"),
    act("sports"), act("playdate"), act("school"),
  ],
  teen_adult: [
    act("walk"), act("music"), act("tv_movies"), act("games"), act("art", "art_adult"), act("cooking"), act("exercise"),
    act("social_outing"), act("community_outing"), act("day_program"), act("work_volunteer"), act("therapy", "therapy_session"),
  ],
};

export function activityLabel(key: string, custom: Option[] = []): string {
  const fromCustom = custom.find((o) => o.key === key);
  return fromCustom ? fromCustom.label : messageOr("activity", key);
}

export function enjoymentLabel(level: number): string {
  return t(`options.enjoyment.${level}`);
}

export function enjoymentLabels(): string[] {
  return [1, 2, 3, 4, 5].map((n) => t(`options.enjoyment.${n}`));
}

export const ACTIVITY_DURATIONS = ([5, 15, 30, 60, 90] as const).map((min) => ({ min, get label() { return t(`options.duration.${min}`); } }));

// ─── Mood ────────────────────────────────────────────────────────────────────

export function moodLabels(stage: CareStage): readonly string[] {
  const ns = stage === "baby" ? "moodBaby" : "mood";
  return [1, 2, 3, 4, 5].map((n) => t(`options.${ns}.${n}`));
}

export const FEELINGS: Record<CareStage, Option[]> = {
  baby: set("feeling", ["fussy", "crying_a_lot", "sleepy", "alert", "calm", "gassy", "teething"]),
  child: set("feeling", ["calm", "happy", "tired", "anxious", "frustrated", "sad", "silly", "excited", "angry", "overwhelmed", "sick", "in_pain"]),
  teen_adult: set("feeling", ["calm", "happy", "tired", "anxious", "frustrated", "sad", "playful", "excited", "angry", "overwhelmed", "sick", "in_pain"]),
};

const ALL_BEHAVIORS = set("behavior", ["meltdown", "tantrum", "aggression", "self_injury", "running_off", "increased_stimming", "withdrawn", "transitions", "crying_spells"]);

export function behaviors(stage: CareStage): Option[] {
  if (stage === "baby") return [];
  if (stage === "teen_adult") return ALL_BEHAVIORS.filter((b) => b.key !== "tantrum");
  return ALL_BEHAVIORS;
}

export function behaviorLabel(key: string): string {
  return messageOr("behavior", key);
}

export function feelingLabel(key: string): string {
  return messageOr("feeling", key);
}

export const SEVERITIES = set("severity", ["mild", "moderate", "severe"] as const);

// ─── Medication ──────────────────────────────────────────────────────────────

// Forms and units are stored as entered (data), so they're not translated here.
export const MED_FORMS = [
  "Liquid", "Tablet", "Capsule", "Chewable", "Dissolving tablet", "Drops", "Inhaler", "Nebulizer",
  "Cream/ointment", "Patch", "Injection", "Suppository", "Powder", "Other",
] as const;

export const DOSE_UNITS = [
  "mL", "mg", "mcg", "tablet", "capsule", "drop", "puff", "spray", "application", "unit", "scoop", "other",
] as const;

export const DOSE_OUTCOMES = set("doseOutcome", ["given", "partial", "refused", "spit_up_vomited", "skipped"] as const);
export const PRN_REASONS = set("prnReason", ["fever", "pain", "agitation", "sleep", "cough_cold", "allergy", "constipation", "other"] as const);
export const PRN_FOLLOWUPS = set("prnFollowup", ["helped", "somewhat", "didnt_help"] as const);

export function formatDose(dose: number, unit: string): string {
  const n = Number.isInteger(dose) ? dose : Math.round(dose * 100) / 100;
  return has(`options.doseUnit.${unit}`) ? t(`options.doseUnit.${unit}`, { count: n }) : `${n} ${unit}`;
}

export function doseUnitName(unit: string): string {
  return has(`options.doseUnitName.${unit}`) ? t(`options.doseUnitName.${unit}`) : unit;
}

/** Forms are stored as their English names (MED_FORMS); this shows the translated label. */
export function medFormLabel(form: string): string {
  const key = form.toLowerCase().replace(/[^a-z]+/g, "_");
  return has(`options.medForm.${key}`) ? t(`options.medForm.${key}`) : form;
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
  if (months < 24) return t("options.ageMonths", { count: months });
  return t("options.ageYears", { count: Math.floor(months / 12) });
}

export function careStageLabel(stage: string): string {
  return messageOr("careStage", stage);
}

export function roleLabel(role: string): string {
  return messageOr("role", role);
}
