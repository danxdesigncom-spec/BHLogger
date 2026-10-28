// QL-09 quick taps: one-tap presets saved from an entry. A template is the entry's type and data,
// minus anything tied to one moment: the scheduled slot, a duplicate override, a follow-up answer.
import type { Json } from "@/lib/supabase/types";

export const MAX_FAVORITES = 6;
export const FAVORITE_TYPES = ["bathroom", "eating", "activity", "mood", "medication"] as const;

export interface FavoriteTemplate {
  type: string;
  data: Record<string, unknown>;
}

export function templateFromEntry(e: { type: string; data: Json | Record<string, unknown> }): FavoriteTemplate | null {
  if (!(FAVORITE_TYPES as readonly string[]).includes(e.type)) return null;
  const data = { ...((e.data ?? {}) as Record<string, unknown>) };
  if (e.type === "medication") {
    // A quick tap means "gave the usual dose"; the slot is worked out when it's tapped.
    Object.assign(data, { outcome: "given", scheduled_for: null, duplicate_override: false, followup: null });
  }
  if (e.type === "mood") data.scope = "moment";
  return { type: e.type, data };
}

export function parseTemplate(value: Json): FavoriteTemplate | null {
  const v = value as { type?: unknown; data?: unknown } | null;
  if (!v || typeof v.type !== "string" || !v.data || typeof v.data !== "object") return null;
  return { type: v.type, data: v.data as Record<string, unknown> };
}

const stable = (v: unknown): string =>
  Array.isArray(v) ? `[${v.map(stable).join(",")}]`
  : v && typeof v === "object" ? `{${Object.keys(v).sort().map((k) => `${k}:${stable((v as Record<string, unknown>)[k])}`).join(",")}}`
  : JSON.stringify(v ?? null);

export function sameTemplate(a: FavoriteTemplate, b: FavoriteTemplate): boolean {
  return a.type === b.type && stable(a.data) === stable(b.data);
}
