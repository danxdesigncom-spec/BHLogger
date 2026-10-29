// DSH-09 food insights (EAT-08, EAT-09). Accepted or refused is worked out from each meal or snack:
// a "refused" reaction or a quarter or less eaten counts as refused, half or more as accepted, and
// anything in between (or no portion) as neither. Thresholds are constants so they can be tuned.
import { dataOf, localParts, type InsightEntry } from "./core";

export const FOOD_RULES = {
  REFUSED_MAX_PCT: 25,
  ACCEPTED_MIN_PCT: 50,
  /** A food needs this many logs before it is ranked. */
  MIN_LOGS: 3,
  TOP: 4,
} as const;

export type FoodOutcome = "accepted" | "refused" | "neither";

const isMealOrSnack = (e: InsightEntry) => e.type === "eating" && !e.deleted_at && ["meal", "snack"].includes(String(dataOf(e).method));
const foodsOf = (e: InsightEntry) => ((dataOf(e).food_ids as unknown[] | undefined) ?? []).map(String);

export function mealOutcome(e: InsightEntry): FoodOutcome {
  const d = dataOf(e);
  const reactions = ((d.reactions as unknown[] | undefined) ?? []).map(String);
  if (reactions.includes("refused")) return "refused";
  if (typeof d.portion_pct !== "number") return "neither";
  if (d.portion_pct <= FOOD_RULES.REFUSED_MAX_PCT) return "refused";
  if (d.portion_pct >= FOOD_RULES.ACCEPTED_MIN_PCT) return "accepted";
  return "neither";
}

export interface FoodStat {
  key: string;
  logs: number;
  accepted: number;
  refused: number;
  /** Whole percent of logs that were accepted or refused. */
  acceptedPct: number;
  refusedPct: number;
}

export function foodStats(entries: InsightEntry[]): FoodStat[] {
  const by = new Map<string, { logs: number; accepted: number; refused: number }>();
  for (const e of entries.filter(isMealOrSnack)) {
    const outcome = mealOutcome(e);
    for (const key of new Set(foodsOf(e))) {
      const s = by.get(key) ?? { logs: 0, accepted: 0, refused: 0 };
      s.logs += 1;
      if (outcome === "accepted") s.accepted += 1;
      if (outcome === "refused") s.refused += 1;
      by.set(key, s);
    }
  }
  return [...by.entries()].map(([key, s]) => ({
    key, ...s,
    acceptedPct: Math.round((s.accepted / s.logs) * 100),
    refusedPct: Math.round((s.refused / s.logs) * 100),
  }));
}

/**
 * Foods logged at least MIN_LOGS times, best accepted first. One list rather than two, so a food that's
 * often eaten and often refused isn't shown as both. With more than 2 × TOP foods, the rows are the
 * TOP best and the TOP most refused; the table has them all.
 */
export function rankFoods(stats: FoodStat[]) {
  const byName = (a: FoodStat, b: FoodStat) => a.key.localeCompare(b.key);
  const ranked = stats
    .filter((s) => s.logs >= FOOD_RULES.MIN_LOGS)
    .sort((a, b) => b.acceptedPct - a.acceptedPct || a.refusedPct - b.refusedPct || b.logs - a.logs || byName(a, b));
  const best = ranked.find((s) => s.accepted > 0) ?? null;
  const refused = ranked.filter((s) => s.refused > 0).sort((a, b) => b.refusedPct - a.refusedPct || b.logs - a.logs || byName(a, b))[0] ?? null;
  const rows = ranked.length <= FOOD_RULES.TOP * 2 ? ranked : [...ranked.slice(0, FOOD_RULES.TOP), ...ranked.slice(-FOOD_RULES.TOP)];
  return { ranked, best, refused, rows, hidden: ranked.length - rows.length };
}

export interface FoodIntroduction {
  day: string;
  at: string;
  foods: string[];
  outcome: FoodOutcome;
  reactions: string[];
}

/** EAT-09: meals and snacks marked "New food", oldest first. */
export function foodIntroductions(entries: InsightEntry[]): FoodIntroduction[] {
  return entries
    .filter((e) => isMealOrSnack(e) && dataOf(e).new_food === true)
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
    .map((e) => ({
      day: localParts(e).day,
      at: e.occurred_at,
      foods: foodsOf(e),
      outcome: mealOutcome(e),
      reactions: ((dataOf(e).reactions as unknown[] | undefined) ?? []).map(String).filter((r) => r !== "refused" && r !== "none"),
    }));
}
