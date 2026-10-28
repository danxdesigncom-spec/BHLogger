import {
  activityLabel, behaviorLabel, BRISTOL, feelingLabel, formatVolume, INFANT_CONSISTENCY, labelFor as labelFromList, MEAL_TYPES,
  moodLabels, portionLabel, PRN_FOLLOWUPS, PRN_REASONS, REACTIONS,
} from "@/lib/options";
import { t } from "@/lib/i18n";

export { activityLabel, behaviorLabel, feelingLabel, formatVolume, MEAL_TYPES, moodLabels, portionLabel, PRN_REASONS };

export function labelFor(list: "reaction" | "prn" | "followup", key: string): string {
  return labelFromList(list === "reaction" ? REACTIONS : list === "prn" ? PRN_REASONS : PRN_FOLLOWUPS, key);
}

export function consistencyText(key: string): string {
  const n = Number(key);
  if (Number.isInteger(n) && n >= 1 && n <= 7) return t("options.bristolType", { n });
  return labelFromList(INFANT_CONSISTENCY, key);
}

export { BRISTOL };
