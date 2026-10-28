"use client";

import { useState } from "react";
import { Check, AlertTriangle } from "lucide-react";
import type { ModuleFormContext } from "../LogSheet";
import { useHousehold } from "@/lib/context/household-provider";

type MealType = "meal" | "snack" | "drink";
type WhichMeal = "breakfast" | "lunch" | "dinner";
type Portion = 0 | 25 | 50 | 75 | 100;

const PORTION_LABELS: Record<Portion, string> = {
  0: "None",
  25: "A little",
  50: "Half",
  75: "Most",
  100: "All",
};

// Portion plate SVGs (viewBox="0 0 24 24", eating accent #EE8A5A)
const PORTION_SVGS: Record<Portion, string> = {
  0:   '<circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" fill="none"/>',
  25:  '<circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M12 12L12 5A7 7 0 0 1 19 12Z" fill="currentColor" stroke="none"/>',
  50:  '<circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M12 12L12 5A7 7 0 0 1 12 19Z" fill="currentColor" stroke="none"/>',
  75:  '<circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M12 12L12 5A7 7 0 1 1 5 12Z" fill="currentColor" stroke="none"/>',
  100: '<circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" fill="none"/><circle cx="12" cy="12" r="7" fill="currentColor" stroke="none"/>',
};

const DEFAULT_FOODS = ["Pasta", "Carrots", "Chicken", "Apple slices", "Yogurt"];

// Reactions that trigger the urgent notice (EAT-06)
const URGENT_REACTIONS = ["Trouble breathing", "Swelling", "Hives", "Vomiting"];

// Auto-select meal by time of day
function autoMeal(): WhichMeal {
  const h = new Date().getHours();
  if (h < 11) return "breakfast";
  if (h < 15) return "lunch";
  return "dinner";
}

const PILL_SEL = "bg-[var(--color-profile)] border-[var(--color-profile)] text-white";
const PILL_OFF = "bg-[var(--color-secondary)] border-[var(--color-border)] text-foreground";
const TILE_SEL = "relative bg-[var(--color-profile-tint)] border-2 border-[var(--color-profile)] text-foreground";
const TILE_OFF = "bg-[var(--color-secondary)] border-[1.5px] border-[var(--color-border)] text-foreground";

interface Props { ctx: ModuleFormContext }

export function EatingSheet({ ctx }: Props) {
  const { profiles, activeProfileId } = useHousehold();
  const profile = profiles.find((p) => p.id === activeProfileId);
  const isBaby = profile?.careStage === "baby";

  const [mealType, setMealType] = useState<MealType>("meal");
  const [whichMeal, setWhichMeal] = useState<WhichMeal>(autoMeal);
  const [portion, setPortion] = useState<Portion | null>(null);
  const [foods, setFoods] = useState<Set<string>>(new Set());
  const [reactions, setReactions] = useState<Set<string>>(new Set());
  const [urgentVisible, setUrgentVisible] = useState(false);

  if (isBaby) return null; // Baby uses FeedingSheet

  const push = (overrides: Record<string, unknown> = {}) => {
    const t = (overrides.mealType as MealType) ?? mealType;
    const wm = (overrides.whichMeal as WhichMeal) ?? whichMeal;
    const p = (overrides.portion as Portion | null) !== undefined ? (overrides.portion as Portion | null) : portion;
    const f = (overrides.foods as Set<string>) ?? foods;
    const data: Record<string, unknown> = { type: t };
    if (t === "meal") data.which = wm;
    if (p !== null) data.portionPct = p;
    if (f.size > 0) data.foods = Array.from(f);
    const label = t === "meal" ? (wm.charAt(0).toUpperCase() + wm.slice(1)) : t === "snack" ? "Snack" : "Drink";
    ctx.setData(data, label);
  };

  const toggleFood = (food: string) => {
    setFoods((prev) => {
      const next = new Set(prev);
      if (next.has(food)) next.delete(food); else next.add(food);
      push({ foods: next });
      return next;
    });
  };

  const toggleReaction = (r: string) => {
    setReactions((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r); else next.add(r);
      const hasUrgent = URGENT_REACTIONS.some((u) => next.has(u));
      setUrgentVisible(hasUrgent);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Meal / Snack / Drink */}
      <div>
        <h2 className="text-[14px] font-extrabold text-muted-foreground mb-2">What kind?</h2>
        <div className="grid grid-cols-3 gap-2">
          {(["meal", "snack", "drink"] as MealType[]).map((t) => {
            const sel = mealType === t;
            return (
              <button
                key={t}
                type="button"
                aria-pressed={sel}
                onClick={() => { setMealType(t); push({ mealType: t }); }}
                className={`min-h-[64px] flex items-center justify-center gap-1.5 rounded-[18px] border-[1.5px] text-[17px] font-extrabold cursor-pointer transition-colors ${sel ? PILL_SEL : PILL_OFF}`}
              >
                {sel && <Check size={16} strokeWidth={3} />}
                {t === "meal" ? "Meal" : t === "snack" ? "Snack" : "Drink"}
              </button>
            );
          })}
        </div>
      </div>

      {/* Which meal (only for Meal) */}
      {mealType === "meal" && (
        <div>
          <h2 className="text-[14px] font-extrabold text-muted-foreground mb-2">Which meal?</h2>
          <div className="flex gap-2">
            {(["breakfast", "lunch", "dinner"] as WhichMeal[]).map((w) => {
              const sel = whichMeal === w;
              return (
                <button
                  key={w}
                  type="button"
                  aria-pressed={sel}
                  onClick={() => { setWhichMeal(w); push({ whichMeal: w }); }}
                  className={`min-h-[44px] px-4 flex items-center gap-1.5 rounded-full border font-bold text-[15px] cursor-pointer transition-colors ${sel ? PILL_SEL : PILL_OFF}`}
                >
                  {sel && <Check size={14} strokeWidth={3} />}
                  {w.charAt(0).toUpperCase() + w.slice(1)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Portion plate (not for Drink) */}
      {mealType !== "drink" && (
        <div>
          <h2 className="text-[14px] font-extrabold text-muted-foreground mb-2">How much?</h2>
          <div className="grid grid-cols-5 gap-1.5">
            {([0, 25, 50, 75, 100] as Portion[]).map((p) => {
              const sel = portion === p;
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={sel}
                  onClick={() => { setPortion(p); push({ portion: p }); }}
                  className={`min-h-[76px] flex flex-col items-center justify-center gap-1.5 rounded-[18px] border-[1.5px] cursor-pointer transition-colors ${sel ? TILE_SEL : TILE_OFF}`}
                >
                  {sel && (
                    <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[var(--color-profile)] text-white flex items-center justify-center">
                      <Check size={10} strokeWidth={3} />
                    </span>
                  )}
                  <svg
                    viewBox="0 0 24 24"
                    width={36}
                    height={36}
                    className="text-[var(--module-eating-ink)]"
                    aria-hidden="true"
                    dangerouslySetInnerHTML={{ __html: PORTION_SVGS[p] }}
                  />
                  <span className="text-[12px] font-extrabold text-center leading-tight px-0.5">
                    {PORTION_LABELS[p]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Foods */}
      {mealType !== "drink" && (
        <div>
          <h2 className="text-[14px] font-extrabold text-muted-foreground mb-2">Foods</h2>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_FOODS.map((food) => {
              const sel = foods.has(food);
              return (
                <button
                  key={food}
                  type="button"
                  aria-pressed={sel}
                  onClick={() => toggleFood(food)}
                  className={`min-h-[44px] px-4 flex items-center gap-1.5 rounded-full border font-bold text-[15px] cursor-pointer transition-colors ${sel ? PILL_SEL : PILL_OFF}`}
                >
                  {sel && <Check size={14} strokeWidth={3} />}
                  {food}
                </button>
              );
            })}
            <button
              type="button"
              className={`min-h-[44px] px-4 flex items-center gap-1.5 rounded-full border-[1.5px] border-dashed font-bold text-[15px] cursor-pointer ${PILL_OFF}`}
            >
              + Add food
            </button>
          </div>
        </div>
      )}

      {/* Reactions (EAT-06) */}
      <div>
        <h2 className="text-[14px] font-extrabold text-muted-foreground mb-2">Any reaction?</h2>
        <div className="flex flex-wrap gap-2">
          {URGENT_REACTIONS.map((r) => {
            const sel = reactions.has(r);
            return (
              <button
                key={r}
                type="button"
                aria-pressed={sel}
                onClick={() => toggleReaction(r)}
                className={`min-h-[44px] px-4 flex items-center gap-1.5 rounded-full border font-bold text-[15px] cursor-pointer transition-colors ${sel ? "bg-[var(--color-warning)] border-[var(--color-warning-border)] text-[var(--color-warning-ink)]" : PILL_OFF}`}
              >
                {sel && <Check size={14} strokeWidth={3} />}
                {r}
              </button>
            );
          })}
        </div>
      </div>

      {/* Urgent notice (EAT-06) */}
      {urgentVisible && (
        <div
          role="alert"
          className="flex items-start gap-3 p-4 rounded-[18px] border"
          style={{ background: "#FFF0F0", borderColor: "#FCA5A5", color: "#7F1D1D" }}
        >
          <AlertTriangle size={22} strokeWidth={2} className="flex-none mt-0.5" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <span className="text-[15px] font-extrabold">Trouble breathing or swelling?</span>
            <span className="text-[14px] leading-snug">Call 911 immediately if there are signs of a severe allergic reaction.</span>
          </div>
        </div>
      )}
    </div>
  );
}
