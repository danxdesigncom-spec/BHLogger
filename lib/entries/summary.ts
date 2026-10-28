import type { CareStage, Toileting } from "@/lib/supabase/types";
import { formatTime } from "@/lib/prefs";
import {
  activityLabel, behaviorLabel, BRISTOL, bathroomKindLabel, ENJOYMENT_LABELS, feelingLabel, formatDose,
  formatVolume, humanize, INFANT_CONSISTENCY, labelFor, MEAL_TYPES, moodLabels, portionLabel, PRN_REASONS,
  DOSE_OUTCOMES, STOOL_COLORS, BOTTLE_CONTENTS, DRINKS, REACTIONS, type BathroomKind, type Option,
} from "@/lib/options";

export interface SummaryContext {
  careStage: CareStage;
  toileting: Toileting;
  volumeUnit: "ml" | "oz";
  medicationName?: (id: string) => string | undefined;
  customActivities?: Option[];
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
    return b ? `Type ${b.type}, ${b.short.toLowerCase()}` : undefined;
  }
  if (typeof value === "string") return labelFor(INFANT_CONSISTENCY, value);
  return undefined;
}

/** "Pasta, carrots": sentence case for a list of option labels. */
export function sentenceList(labels: string[]): string {
  return labels.map((l, i) => (i === 0 ? l : l.charAt(0).toLowerCase() + l.slice(1))).join(", ");
}

/** Short label used in toasts and tile statuses: "Wet", "BM", "Dinner", "4 oz bottle". */
export function entryShortLabel(e: EntryLike, ctx: SummaryContext): string {
  const d = (e.data ?? {}) as D;
  switch (e.type) {
    case "bathroom":
      return bathroomKindLabel((str(d.kind) ?? "pee") as BathroomKind, ctx.toileting);
    case "eating": {
      const m = str(d.method);
      if (m === "breast") return d.side ? `Breast, ${String(d.side)}` : "Breastfed";
      if (m === "bottle") return num(d.amount_ml) ? `${formatVolume(num(d.amount_ml)!, ctx.volumeUnit)} bottle` : "Bottle";
      if (m === "drink") return labelFor(DRINKS, str(d.contents) ?? "other");
      if (m === "meal") return d.portion_pct !== undefined ? `Ate ${portionLabel(Number(d.portion_pct)).toLowerCase()}` : labelFor(MEAL_TYPES, str(d.meal_type) ?? "meal");
      if (m === "snack") return "Snack";
      return "Eating";
    }
    case "activity":
      return activityLabel(str(d.activity_id) ?? "activity", ctx.customActivities);
    case "mood": {
      const level = num(d.level);
      return level ? moodLabels(ctx.careStage)[level - 1] : "Mood";
    }
    case "medication":
      return ctx.medicationName?.(str(d.medication_id) ?? "") ?? "Medication";
    default:
      return humanize(e.type);
  }
}

/** Timeline title: "Dinner · ate half", "Ibuprofen · given", "Upset · meltdown". */
export function entryTitle(e: EntryLike, ctx: SummaryContext): string {
  const d = (e.data ?? {}) as D;
  switch (e.type) {
    case "bathroom": {
      const kind = (str(d.kind) ?? "pee") as BathroomKind;
      const label = bathroomKindLabel(kind, ctx.toileting);
      if (ctx.toileting === "diapers") return kind === "dry" ? "Dry diaper" : `${label} diaper`;
      if (str(d.location) === "accident") return `${label} · accident`;
      return label;
    }
    case "eating": {
      const m = str(d.method);
      if (m === "meal") {
        const meal = labelFor(MEAL_TYPES, str(d.meal_type) ?? "meal");
        return d.portion_pct !== undefined ? `${meal} · ate ${portionLabel(Number(d.portion_pct)).toLowerCase()}` : meal;
      }
      if (m === "snack") {
        return d.portion_pct !== undefined ? `Snack · ate ${portionLabel(Number(d.portion_pct)).toLowerCase()}` : "Snack";
      }
      if (m === "breast") return d.side ? `Breastfed · ${String(d.side)}` : "Breastfed";
      if (m === "bottle") return num(d.amount_ml) ? `Bottle · ${formatVolume(num(d.amount_ml)!, ctx.volumeUnit)}` : "Bottle";
      if (m === "drink") {
        const what = labelFor(DRINKS, str(d.contents) ?? "other");
        return num(d.amount_ml) ? `${what} · ${formatVolume(num(d.amount_ml)!, ctx.volumeUnit)}` : what;
      }
      return "Eating";
    }
    case "activity": {
      const name = activityLabel(str(d.activity_id) ?? "activity", ctx.customActivities);
      const enj = num(d.enjoyment);
      return enj ? `${name} · ${ENJOYMENT_LABELS[enj - 1].toLowerCase()}` : name;
    }
    case "mood": {
      const level = num(d.level);
      const mood = level ? moodLabels(ctx.careStage)[level - 1] : "Mood";
      const b = arr(d.behaviors)[0] as D | undefined;
      const prefix = str(d.scope) === "day" ? "Day overall: " : "";
      return b ? `${prefix}${mood} · ${behaviorLabel(String(b.key)).toLowerCase()}` : `${prefix}${mood}`;
    }
    case "medication": {
      const name = ctx.medicationName?.(str(d.medication_id) ?? "") ?? "Medication";
      const outcome = labelFor(DOSE_OUTCOMES, str(d.outcome) ?? "given").toLowerCase();
      return `${name} · ${outcome}`;
    }
    default:
      return humanize(e.type);
  }
}

/** Timeline detail line: "7.5 mL · as needed, fever", "Brown · type 4, smooth". */
export function entryDetail(e: EntryLike): string {
  const d = (e.data ?? {}) as D;
  const parts: string[] = [];
  switch (e.type) {
    case "bathroom": {
      if (d.color) parts.push(labelFor(STOOL_COLORS, String(d.color)));
      const c = consistencyLabel(d.consistency);
      if (c) parts.push(c.toLowerCase());
      if (d.size) parts.push(String(d.size));
      for (const f of arr(d.flags)) parts.push(humanize(String(f)).toLowerCase());
      break;
    }
    case "eating": {
      const m = str(d.method);
      if (m === "breast" && num(d.duration_min)) parts.push(`${d.duration_min} min`);
      if (m === "bottle" && d.contents) parts.push(labelFor(BOTTLE_CONTENTS, String(d.contents)));
      if (m === "meal" || m === "snack") {
        const list = arr(d.food_ids).length ? arr(d.food_ids) : arr(d.food_groups);
        if (list.length) parts.push(sentenceList(list.map((f) => humanize(String(f)))));
      }
      const reactions = arr(d.reactions).map((r) => labelFor(REACTIONS, String(r)));
      if (reactions.length) parts.push(reactions.join(", "));
      break;
    }
    case "activity":
      if (num(d.duration_min)) parts.push(num(d.duration_min)! >= 90 ? "90+ min" : `${d.duration_min} min`);
      break;
    case "mood": {
      const b = arr(d.behaviors)[0] as D | undefined;
      if (b?.severity) parts.push(humanize(String(b.severity)));
      const feelings = arr(d.feelings).map((f) => feelingLabel(String(f)));
      if (feelings.length) parts.push(feelings.join(", "));
      break;
    }
    case "medication": {
      if (num(d.dose)) parts.push(formatDose(num(d.dose)!, str(d.unit) ?? ""));
      if (d.prn_reason) parts.push(`as needed, ${labelFor(PRN_REASONS, String(d.prn_reason)).toLowerCase()}`);
      if (d.duplicate_override) parts.push("extra dose confirmed");
      break;
    }
  }
  return parts.join(" · ");
}

/** "just now", "12 min ago", "6:45 PM", "Yesterday 6:45 PM", "Mon 6:45 PM", "Oct 3". */
export function formatWhen(iso: string, now = new Date()): string {
  const t = new Date(iso);
  const diffMin = Math.floor((now.getTime() - t.getTime()) / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const clock = formatTime(t);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const dayDiff = Math.floor((startOfToday.getTime() - new Date(t).setHours(0, 0, 0, 0)) / 86_400_000);
  if (dayDiff <= 0) return clock;
  if (dayDiff === 1) return `Yesterday ${clock}`;
  if (dayDiff < 7) return `${t.toLocaleDateString("en-US", { weekday: "short" })} ${clock}`;
  return t.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** "just now", "12 min ago", "2 h ago", "3 d ago". */
export function formatAgo(iso: string, now = new Date()): string {
  const min = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  if (min < 48 * 60) return `${Math.floor(min / 60)} h ago`;
  return `${Math.floor(min / 1440)} d ago`;
}

export function formatClock(iso: string): string {
  return formatTime(iso);
}

/** Tile status: "Ate half · 6:45 PM", "Wet · just now", "Playground · loved it". */
export function tileStatus(e: EntryLike | null | undefined, ctx: SummaryContext, now = new Date()): string {
  if (!e) return "Nothing logged yet";
  const d = (e.data ?? {}) as D;
  if (e.type === "activity" && num(d.enjoyment)) {
    return `${entryShortLabel(e, ctx)} · ${ENJOYMENT_LABELS[num(d.enjoyment)! - 1].toLowerCase()}`;
  }
  return `${entryShortLabel(e, ctx)} · ${formatWhen(e.occurred_at, now)}`;
}
