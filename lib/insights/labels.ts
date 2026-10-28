import {
  activityLabel, behaviorLabel, BRISTOL, feelingLabel, formatVolume, INFANT_CONSISTENCY, labelFor as labelFromList, MEAL_TYPES,
  moodLabels, portionLabel, PRN_REASONS, REACTIONS,
} from "@/lib/options";

export { activityLabel, behaviorLabel, feelingLabel, formatVolume, MEAL_TYPES, moodLabels, portionLabel, PRN_REASONS };

export function labelFor(list: "reaction" | "prn", key: string): string {
  return labelFromList(list === "reaction" ? REACTIONS : PRN_REASONS, key);
}

export function consistencyText(key: string): string {
  const n = Number(key);
  if (Number.isInteger(n) && n >= 1 && n <= 7) return `Type ${n}`;
  return labelFromList(INFANT_CONSISTENCY, key);
}

export { BRISTOL };
