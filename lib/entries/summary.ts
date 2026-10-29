import type { CareStage, Toileting } from "@/lib/supabase/types";
import { dateLocale, formatTime, formatWeekdayTime } from "@/lib/prefs";
import {
  activityLabel, behaviorLabel, BM_FLAGS, BM_SIZES, BOTTLE_CONTENTS, BREAST_SIDES, BRISTOL, bathroomKindLabel, DOSE_OUTCOMES,
  DRINKS, enjoymentLabel, feelingLabel, FOOD_GROUPS, formatDose, formatVolume, humanize, INFANT_CONSISTENCY, labelFor,
  MEAL_TYPES, moodLabels, portionLabel, PRN_REASONS, REACTIONS, SEVERITIES, STOOL_COLORS, type BathroomKind, type Option,
  TUBE_DELIVERY, durationLabel,
} from "@/lib/options";
import { t } from "@/lib/i18n";

export interface SummaryContext {
  careStage: CareStage;
  toileting: Toileting;
  volumeUnit: "ml" | "oz";
  medicationName?: (id: string) => string | undefined;
  customActivities?: Option[];
  /** Names from the profile's foods and formulas lists (EAT-08, EAT-10). */
  optionLabel?: (module: "food" | "formula", key: string) => string;
}

interface EntryLike {
  type: string;
  data: unknown;
  occurred_at: string;
}

type D = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : undefined);
const num = (v: unknown) => (typeof v === "number" ? v : undefined);
const arr = (v: unknown) => (Array.isArray(v) ? (v as unknown[]) : []);

export function consistencyLabel(value: unknown): string | undefined {
  if (typeof value === "number") {
    const b = BRISTOL.find((x) => x.type === value);
    return b ? t("options.bristolTypeShort", { n: b.type, label: b.short.toLowerCase() }) : undefined;
  }
  if (typeof value === "string") return labelFor(INFANT_CONSISTENCY, value);
  return undefined;
}

/** "Pasta, carrots": sentence case for a list of option labels. */
export function sentenceList(labels: string[]): string {
  return labels.map((l, i) => (i === 0 ? l : l.charAt(0).toLowerCase() + l.slice(1))).join(", ");
}

const lower = (s: string) => s.toLowerCase();

/** Short label used in toasts and tile statuses: "Wet", "BM", "Dinner", "4 oz bottle". */
export function entryShortLabel(e: EntryLike, ctx: SummaryContext): string {
  const d = (e.data ?? {}) as D;
  switch (e.type) {
    case "bathroom":
      return bathroomKindLabel((str(d.kind) ?? "pee") as BathroomKind, ctx.toileting);
    case "eating": {
      const m = str(d.method);
      if (m === "breast") return d.side ? t("summary.breastShort", { side: lower(labelFor(BREAST_SIDES, String(d.side))) }) : t("summary.breastfed");
      if (m === "bottle") return num(d.amount_ml) ? t("summary.bottleShort", { amount: formatVolume(num(d.amount_ml)!, ctx.volumeUnit) }) : t("summary.bottle");
      if (m === "drink") return labelFor(DRINKS, str(d.contents) ?? "other");
      if (m === "meal") return d.portion_pct !== undefined ? t("summary.ate", { portion: lower(portionLabel(Number(d.portion_pct))) }) : labelFor(MEAL_TYPES, str(d.meal_type) ?? "meal");
      if (m === "snack") return t("summary.snack");
      if (m === "tube") return t("summary.tube", { amount: t("eating.ml", { n: num(d.amount_ml) ?? 0 }) });
      return t("summary.eating");
    }
    case "activity":
      return activityLabel(str(d.activity_id) ?? "activity", ctx.customActivities);
    case "mood": {
      const level = num(d.level);
      return level ? moodLabels(ctx.careStage)[level - 1] : t("summary.mood");
    }
    case "medication":
      return ctx.medicationName?.(str(d.medication_id) ?? "") ?? t("summary.medication");
    default:
      return humanize(e.type);
  }
}

/** The label a new quick tap gets (QL-09): "Pee", "Wet diaper", "4 oz bottle", or the medication's name. */
export function favoriteLabel(e: { type: string; data: unknown }, ctx: SummaryContext): string {
  const d = (e.data ?? {}) as D;
  if (e.type === "bathroom" && ctx.toileting === "diapers") return t("summary.diaperTitle", { kind: str(d.kind) ?? "other" });
  return entryShortLabel({ ...e, occurred_at: "" }, ctx);
}

/** Timeline title: "Dinner · ate half", "Ibuprofen · given", "Upset · meltdown". */
export function entryTitle(e: EntryLike, ctx: SummaryContext): string {
  const d = (e.data ?? {}) as D;
  switch (e.type) {
    case "bathroom": {
      const kind = (str(d.kind) ?? "pee") as BathroomKind;
      if (ctx.toileting === "diapers") return t("summary.diaperTitle", { kind });
      const label = bathroomKindLabel(kind, ctx.toileting);
      if (str(d.location) === "accident") return t("summary.accident", { label });
      return label;
    }
    case "eating": {
      const m = str(d.method);
      const portion = d.portion_pct !== undefined ? lower(portionLabel(Number(d.portion_pct))) : null;
      if (m === "meal") {
        const meal = labelFor(MEAL_TYPES, str(d.meal_type) ?? "meal");
        return portion ? t("summary.mealAte", { meal, portion }) : meal;
      }
      if (m === "snack") return portion ? t("summary.snackAte", { portion }) : t("summary.snack");
      if (m === "breast") return d.side ? t("summary.breastfedSide", { side: lower(labelFor(BREAST_SIDES, String(d.side))) }) : t("summary.breastfed");
      if (m === "bottle") return num(d.amount_ml) ? t("summary.bottleAmount", { amount: formatVolume(num(d.amount_ml)!, ctx.volumeUnit) }) : t("summary.bottle");
      if (m === "drink") {
        const drink = labelFor(DRINKS, str(d.contents) ?? "other");
        return num(d.amount_ml) ? t("summary.drinkAmount", { drink, amount: formatVolume(num(d.amount_ml)!, ctx.volumeUnit) }) : drink;
      }
      if (m === "tube") return t("summary.tube", { amount: t("eating.ml", { n: num(d.amount_ml) ?? 0 }) });
      return t("summary.eating");
    }
    case "activity": {
      const name = activityLabel(str(d.activity_id) ?? "activity", ctx.customActivities);
      const enj = num(d.enjoyment);
      return enj ? t("summary.withEnjoyment", { name, enjoyment: lower(enjoymentLabel(enj)) }) : name;
    }
    case "mood": {
      const level = num(d.level);
      const mood = level ? moodLabels(ctx.careStage)[level - 1] : t("summary.mood");
      const b = arr(d.behaviors)[0] as D | undefined;
      const title = b ? t("summary.withBehavior", { mood, behavior: lower(behaviorLabel(String(b.key))) }) : mood;
      return str(d.scope) === "day" ? t("summary.dayOverall", { title }) : title;
    }
    case "medication": {
      const name = ctx.medicationName?.(str(d.medication_id) ?? "") ?? t("summary.medication");
      return t("summary.doseOutcome", { name, outcome: lower(labelFor(DOSE_OUTCOMES, str(d.outcome) ?? "given")) });
    }
    default:
      return humanize(e.type);
  }
}

/** Timeline detail line: "7.5 mL · as needed, fever", "Brown · type 4, smooth". */
export function entryDetail(e: EntryLike, ctx?: Pick<SummaryContext, "optionLabel">): string {
  const d = (e.data ?? {}) as D;
  const option = (module: "food" | "formula", key: string) => ctx?.optionLabel?.(module, key) ?? humanize(key.replace(/^opt_/, ""));
  const parts: string[] = [];
  switch (e.type) {
    case "bathroom": {
      if (d.color) parts.push(labelFor(STOOL_COLORS, String(d.color)));
      const c = consistencyLabel(d.consistency);
      if (c) parts.push(lower(c));
      if (d.size) parts.push(lower(labelFor(BM_SIZES, String(d.size))));
      for (const f of arr(d.flags)) parts.push(lower(labelFor(BM_FLAGS, String(f))));
      break;
    }
    case "eating": {
      const m = str(d.method);
      if (m === "breast" && num(d.duration_min)) parts.push(t("summary.minutes", { count: num(d.duration_min)! }));
      if (m === "bottle" && d.contents) parts.push(labelFor(BOTTLE_CONTENTS, String(d.contents)));
      if (m === "meal" || m === "snack") {
        const foods = arr(d.food_ids).map((f) => option("food", String(f)));
        const groups = arr(d.food_groups).map((g) => labelFor(FOOD_GROUPS, String(g)));
        const list = foods.length ? foods : groups;
        if (list.length) parts.push(sentenceList(list));
      }
      if (m === "tube") {
        if (d.formula_id) parts.push(option("formula", String(d.formula_id)));
        if (d.delivery) parts.push(labelFor(TUBE_DELIVERY, String(d.delivery)));
        if (num(d.flush_ml)) parts.push(t("summary.flush", { amount: t("eating.ml", { n: num(d.flush_ml)! }) }));
      }
      const reactions = arr(d.reactions).map((r) => labelFor(REACTIONS, String(r)));
      if (reactions.length) parts.push(reactions.join(", "));
      break;
    }
    case "activity":
      if (num(d.duration_min)) parts.push(num(d.duration_min)! >= 90 ? t("summary.ninetyPlus") : t("summary.minutes", { count: num(d.duration_min)! }));
      break;
    case "mood": {
      const b = arr(d.behaviors)[0] as D | undefined;
      if (b?.severity) parts.push(labelFor(SEVERITIES, String(b.severity)));
      if (num(b?.duration_min)) parts.push(durationLabel(num(b!.duration_min)!));
      const feelings = arr(d.feelings).map((f) => feelingLabel(String(f)));
      if (feelings.length) parts.push(feelings.join(", "));
      break;
    }
    case "medication": {
      if (num(d.dose)) parts.push(formatDose(num(d.dose)!, str(d.unit) ?? ""));
      if (d.prn_reason) parts.push(t("summary.asNeeded", { reason: lower(labelFor(PRN_REASONS, String(d.prn_reason))) }));
      if (d.duplicate_override) parts.push(t("summary.extraDose"));
      break;
    }
  }
  return parts.join(" · ");
}

/** "just now", "12 min ago", "6:45 PM", "Yesterday 6:45 PM", "Mon 6:45 PM", "Oct 3". */
export function formatWhen(iso: string, now = new Date()): string {
  const at = new Date(iso);
  const diffMin = Math.floor((now.getTime() - at.getTime()) / 60_000);
  if (diffMin < 1) return t("common.justNow");
  if (diffMin < 60) return t("common.minAgo", { count: diffMin });
  const clock = formatTime(at);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const dayDiff = Math.floor((startOfToday.getTime() - new Date(at).setHours(0, 0, 0, 0)) / 86_400_000);
  if (dayDiff <= 0) return clock;
  if (dayDiff === 1) return t("summary.yesterdayAt", { time: clock });
  if (dayDiff < 7) return formatWeekdayTime(at);
  return at.toLocaleDateString(dateLocale(), { month: "short", day: "numeric" });
}

/** "just now", "12 min ago", "2 h ago", "3 d ago". */
export function formatAgo(iso: string, now = new Date()): string {
  const min = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return t("common.justNow");
  if (min < 60) return t("common.minAgo", { count: min });
  if (min < 48 * 60) return t("common.hAgo", { count: Math.floor(min / 60) });
  return t("common.dAgo", { count: Math.floor(min / 1440) });
}

export function formatClock(iso: string): string {
  return formatTime(iso);
}

/** Tile status: "Ate half · 6:45 PM", "Wet · just now", "Playground · loved it". */
export function tileStatus(e: EntryLike | null | undefined, ctx: SummaryContext, now = new Date()): string {
  if (!e) return t("common.nothingLoggedYet");
  const d = (e.data ?? {}) as D;
  if (e.type === "activity" && num(d.enjoyment)) {
    return t("summary.withEnjoyment", { name: entryShortLabel(e, ctx), enjoyment: lower(enjoymentLabel(num(d.enjoyment)!)) });
  }
  return t("summary.statusWhen", { label: entryShortLabel(e, ctx), when: formatWhen(e.occurred_at, now) });
}
