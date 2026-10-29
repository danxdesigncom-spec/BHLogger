"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import type { ModuleFormContext } from "../LogSheet";
import { Group, Notice, OptionTiles, RadioChips, Stepper, ToggleChips } from "../controls";
import { TimerStart } from "../TimerStart";
import { PersonalListPicker } from "./FoodPicker";
import { useHousehold } from "@/lib/context/household-provider";
import { useLatestEntry } from "@/lib/data/hooks";
import { formatWhen } from "@/lib/entries/summary";
import {
  ageInMonths, BOTTLE_CONTENTS, BREAST_DURATIONS, BREAST_SIDES, DRINKS, eatingMethodLabel, eatingMethods, FOOD_GROUPS,
  FLUSH_ML_CHIPS, formatVolume, labelFor, mealTypeForHour, MEAL_TYPES, ML_CHIPS, mlToOz, OZ_CHIPS, ozToMl, PORTIONS, REACTIONS, TUBE_DELIVERY,
  TUBE_ML_CHIPS, URGENT_REACTION,
  type EatingMethod,
} from "@/lib/options";

const PLATE: Record<number, string> = {
  0: "",
  25: '<path d="M12 12L12 5A7 7 0 0 1 19 12Z" fill="currentColor" stroke="none"/>',
  50: '<path d="M12 12L12 5A7 7 0 0 1 12 19Z" fill="currentColor" stroke="none"/>',
  75: '<path d="M12 12L12 5A7 7 0 1 1 5 12Z" fill="currentColor" stroke="none"/>',
  100: '<circle cx="12" cy="12" r="7" fill="currentColor" stroke="none"/>',
};

function Plate({ pct }: { pct: number }) {
  return (
    <svg viewBox="0 0 24 24" width={30} height={30} fill="none" stroke="currentColor" strokeWidth={1.75} className="text-eating-ink" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <g dangerouslySetInnerHTML={{ __html: PLATE[pct] }} />
    </svg>
  );
}

const CUPS = [
  { ml: 118, key: "half" },
  { ml: 237, key: "one" },
  { ml: 473, key: "two" },
] as const;

type D = Record<string, unknown>;

export function EatingSheet({ ctx, initial }: { ctx: ModuleFormContext; initial?: Record<string, unknown> }) {
  const { activeProfile, householdSettings } = useHousehold();
  const profileId = activeProfile?.id ?? null;
  const stage = activeProfile?.careStage ?? "child";
  const unit = householdSettings.volume_unit;
  const t = useTranslations();
  const e = (k: string, v?: Record<string, string | number>) => t(`eating.${k}`, v);
  const sideLabel = (s: string) => labelFor(BREAST_SIDES, s).toLowerCase();
  const profileMethods = eatingMethods(stage, activeProfile?.feedingMethods ?? [], ageInMonths(activeProfile?.dob ?? null));
  const initMethod = (initial as { method?: EatingMethod } | undefined)?.method;
  const methods = initMethod && !profileMethods.includes(initMethod) ? [...profileMethods, initMethod] : profileMethods;

  const last = useLatestEntry(profileId, "eating");
  const lastBottle = useLatestEntry(profileId, "eating", { method: "bottle" });
  const lastBreast = useLatestEntry(profileId, "eating", { method: "breast" });
  const lastTube = useLatestEntry(profileId, "eating", { method: "tube" });
  const lastTubeData = lastTube.data?.data as D | undefined;

  const lastMethod = (last.data?.data as D | undefined)?.method as EatingMethod | undefined;
  const lastSide = (lastBreast.data?.data as D | undefined)?.side as string | undefined;
  const startSide = lastSide === "left" ? "right" : lastSide === "right" ? "left" : "left";
  const lastBottleData = lastBottle.data?.data as D | undefined;
  const lastAmountMl = typeof lastBottleData?.amount_ml === "number" ? lastBottleData.amount_ml : null;

  const init = (initial ?? {}) as {
    method?: EatingMethod; side?: string; duration_min?: number; contents?: string; amount_ml?: number;
    meal_type?: "breakfast" | "lunch" | "dinner"; portion_pct?: number; food_groups?: string[]; reactions?: string[];
    food_ids?: string[]; new_food?: boolean; formula_id?: string; delivery?: string; flush_ml?: number;
  };
  const editing = !!initial;
  const [method, setMethod] = useState<EatingMethod>(init.method ?? methods[0]);
  const [touchedMethod, setTouchedMethod] = useState(editing);
  const [side, setSide] = useState<string>(init.side ?? "left");
  const [touchedSide, setTouchedSide] = useState(editing);
  const [duration, setDuration] = useState<number | null>(init.duration_min ?? null);
  const [contents, setContents] = useState<string | null>(init.method === "bottle" ? init.contents ?? null : null);
  const [amountMl, setAmountMl] = useState<number | null>(init.method === "bottle" ? init.amount_ml ?? null : null);
  const [mealType, setMealType] = useState(init.meal_type ?? mealTypeForHour(new Date().getHours()));
  const [portion, setPortion] = useState<number | null>(init.portion_pct ?? null);
  const [drink, setDrink] = useState(init.method === "drink" ? init.contents ?? "water" : "water");
  const [drinkMl, setDrinkMl] = useState<number | null>(init.method === "drink" ? init.amount_ml ?? null : null);
  const [groups, setGroups] = useState<string[]>(init.food_groups ?? []);
  const [reactions, setReactions] = useState<string[]>(init.reactions ?? []);
  const [foods, setFoods] = useState<string[]>(init.food_ids ?? []);
  const [newFood, setNewFood] = useState(init.new_food ?? false);
  const [formula, setFormula] = useState<string | null>(init.method === "tube" ? init.formula_id ?? null : null);
  const [tubeMl, setTubeMl] = useState<number | null>(init.method === "tube" ? init.amount_ml ?? null : null);
  const [delivery, setDelivery] = useState<string | null>(init.method === "tube" ? init.delivery ?? null : null);
  const [flush, setFlush] = useState<number | null>(init.method === "tube" ? init.flush_ml ?? null : editing ? null : -1);

  // QL-06: preselect last-used method, breast start side and bottle amount once they load.
  const effMethod = touchedMethod ? method : lastMethod && methods.includes(lastMethod) ? lastMethod : method;
  const effSide = touchedSide ? side : startSide;
  const effContents = contents ?? ((lastBottleData?.contents as string | undefined) ?? "formula");
  const effAmount = amountMl ?? lastAmountMl ?? (unit === "oz" ? ozToMl(4) : 120);
  // EAT-10 + QL-06: the last tube feed's formula, amount, delivery and flush are the defaults. flush -1 = not touched yet.
  const effFormula = formula ?? ((lastTubeData?.formula_id as string | undefined) ?? null);
  const effTubeMl = tubeMl ?? (typeof lastTubeData?.amount_ml === "number" ? lastTubeData.amount_ml : 120);
  const effDelivery = delivery ?? ((lastTubeData?.delivery as string | undefined) ?? "bolus");
  const effFlush = flush === -1 ? (typeof lastTubeData?.flush_ml === "number" ? lastTubeData.flush_ml : null) : flush;

  useEffect(() => {
    let data: D;
    let summary: string;
    switch (effMethod) {
      case "breast":
        data = { method: "breast", side: effSide, ...(duration ? { duration_min: duration } : {}) };
        summary = e("breastfeedSide", { side: sideLabel(effSide) });
        break;
      case "bottle":
        data = { method: "bottle", contents: effContents, amount_ml: effAmount };
        summary = e("bottleAmount", { amount: formatVolume(effAmount, unit) });
        break;
      case "tube":
        data = { method: "tube", amount_ml: effTubeMl, delivery: effDelivery, ...(effFormula ? { formula_id: effFormula } : {}), ...(effFlush ? { flush_ml: effFlush } : {}) };
        summary = e("tubeSummary", { amount: e("ml", { n: effTubeMl }) });
        break;
      case "drink":
        data = { method: "drink", contents: drink, ...(drinkMl ? { amount_ml: drinkMl } : {}) };
        summary = DRINKS.find((d) => d.key === drink)?.label ?? e("drink");
        break;
      default: {
        const isMeal = effMethod === "meal";
        data = {
          method: effMethod, ...(isMeal ? { meal_type: mealType } : {}), ...(portion !== null ? { portion_pct: portion } : {}),
          food_groups: groups, food_ids: foods, new_food: newFood, reactions,
        };
        summary = isMeal ? (stage === "baby" ? e("solids") : MEAL_TYPES.find((m) => m.key === mealType)!.label) : e("snack");
      }
    }
    ctx.setData(data, summary, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effMethod, effSide, duration, effContents, effAmount, mealType, portion, drink, drinkMl, groups, reactions, foods, newFood, effFormula, effTubeMl, effDelivery, effFlush, unit, stage]);

  const amountChips = unit === "oz" ? OZ_CHIPS.map((oz) => ({ ml: ozToMl(oz), label: e("oz", { n: oz }) })) : ML_CHIPS.map((ml) => ({ ml, label: e("ml", { n: ml }) }));
  const step = unit === "oz" ? ozToMl(0.5) : 10;
  const sameAsLast = lastAmountMl !== null && Math.abs(effAmount - lastAmountMl) < 2;
  // S19 / S27: "Same as last feed", otherwise when the last bottle was and how much.
  const lastBottleHint = lastBottle.data && lastAmountMl !== null
    ? e(last.data?.id === lastBottle.data.id ? "lastFeedHint" : "lastBottleHint", { when: formatWhen(lastBottle.data.occurred_at), amount: formatVolume(lastAmountMl, unit) })
    : undefined;
  const isMealLike = effMethod === "meal" || effMethod === "snack";

  return (
    <div className="space-y-4">
      <Group label={e("how")}>
        <RadioChips
          label={e("howLabel")}
          variant="block"
          columns={Math.min(methods.length, 3)}
          value={effMethod}
          onChange={(m) => { setMethod(m); setTouchedMethod(true); }}
          options={methods.map((m) => ({
            value: m,
            label: eatingMethodLabel(m, stage),
            sub: m === "breast" && lastSide ? e("startOn", { side: sideLabel(startSide) }) : undefined,
          }))}
        />
      </Group>

      {effMethod === "breast" && (
        <>
          <Group label={e("side")} hint={lastSide ? e("lastSide", { side: sideLabel(lastSide) }) : undefined}>
            <RadioChips label={e("side")} value={effSide} onChange={(s) => { setSide(s); setTouchedSide(true); }} options={BREAST_SIDES.map((s) => ({ value: s.key, label: s.label }))} />
          </Group>
          <Group label={e("howLong")}>
            <RadioChips
              label={e("howLongLabel")}
              value={duration}
              onChange={(d) => setDuration(d === duration ? null : d)}
              options={BREAST_DURATIONS.map((d) => ({ value: d, label: t("options.durationMin", { count: d }) }))}
            />
            {ctx.startTimer && (
              <TimerStart
                running={!!ctx.timerRunning}
                onStart={() => ctx.startTimer!({ method: "breast", side: effSide }, e("breastfeedSide", { side: sideLabel(effSide) }))}
              />
            )}
          </Group>
        </>
      )}

      {effMethod === "bottle" && (
        <>
          <Group label={e("bottleWhat")}>
            <RadioChips label={e("bottleContents")} value={effContents} onChange={setContents} options={BOTTLE_CONTENTS.map((c) => ({ value: c.key, label: c.label }))} />
          </Group>
          <Group label={e("howMuch")}>
            <Stepper
              display={formatVolume(effAmount, unit)}
              caption={sameAsLast ? e("sameAsLast") : lastBottleHint}
              onDecrease={() => setAmountMl(Math.max(step, effAmount - step))}
              onIncrease={() => setAmountMl(Math.min(ozToMl(16), effAmount + step))}
              canDecrease={effAmount > step}
            />
            <div role="radiogroup" aria-label={e("amount")} className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${amountChips.length}, minmax(0, 1fr))` }}>
              {amountChips.map((c) => {
                const sel = unit === "oz" ? mlToOz(effAmount) === mlToOz(c.ml) : effAmount === c.ml;
                return (
                  <button
                    key={c.ml}
                    type="button"
                    role="radio"
                    aria-checked={sel}
                    onClick={() => setAmountMl(c.ml)}
                    className={`min-h-touch rounded-full border text-[0.8125rem] font-bold ${sel ? "bg-profile border-profile text-on-profile font-extrabold" : "bg-secondary border-border"}`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </Group>
        </>
      )}

      {effMethod === "meal" && (
        <Group label={e("whichMeal")}>
          <RadioChips label={e("whichMealLabel")} value={mealType} onChange={setMealType} options={MEAL_TYPES.map((m) => ({ value: m.key, label: m.label }))} />
        </Group>
      )}

      {isMealLike && (
        <Group label={e("howMuchEaten")}>
          <OptionTiles
            label={e("howMuchEatenLabel")}
            columns={5}
            value={portion}
            onChange={(p) => setPortion(p === portion ? null : p)}
            options={PORTIONS.map((p) => ({ value: p.pct, label: p.label, ariaLabel: e("portionAria", { label: p.label, pct: p.pct }), icon: <Plate pct={p.pct} /> }))}
          />
        </Group>
      )}

      {isMealLike && (
        <PersonalListPicker
          profileId={profileId}
          module="food"
          selected={foods}
          onChange={setFoods}
          label={e("foods")}
          addLabel={e("addFood")}
          nameLabel={e("foodName")}
        />
      )}

      {effMethod === "tube" && (
        <>
          <PersonalListPicker
            profileId={profileId}
            module="formula"
            multiple={false}
            selected={effFormula ? [effFormula] : []}
            onChange={(keys) => setFormula(keys[0] ?? "")}
            label={e("formula")}
            addLabel={e("addFormula")}
            nameLabel={e("formulaName")}
          />
          <Group label={e("tubeAmount")}>
            <Stepper
              display={e("ml", { n: effTubeMl })}
              onDecrease={() => setTubeMl(Math.max(10, effTubeMl - 10))}
              onIncrease={() => setTubeMl(Math.min(2000, effTubeMl + 10))}
              canDecrease={effTubeMl > 10}
              decreaseLabel={e("lessFormula")}
              increaseLabel={e("moreFormula")}
            />
            <RadioChips label={e("tubeAmountLabel")} value={effTubeMl} onChange={setTubeMl} options={TUBE_ML_CHIPS.map((ml) => ({ value: ml, label: e("ml", { n: ml }) }))} />
          </Group>
          <Group label={e("delivery")}>
            <RadioChips label={e("deliveryLabel")} value={effDelivery} onChange={setDelivery} options={TUBE_DELIVERY.map((d) => ({ value: d.key, label: d.label }))} />
          </Group>
          <Group label={e("flush")} hint={t("common.optional")}>
            <RadioChips
              label={e("flushLabel")}
              value={effFlush}
              onChange={(v) => setFlush(v === effFlush ? null : v)}
              options={FLUSH_ML_CHIPS.map((ml) => ({ value: ml, label: e("ml", { n: ml }) }))}
            />
          </Group>
        </>
      )}

      {effMethod === "drink" && (
        <>
          <Group label={e("what")}>
            <RadioChips label={e("drink")} value={drink} onChange={setDrink} options={DRINKS.map((d) => ({ value: d.key, label: d.label }))} />
          </Group>
          <Group label={e("howMuch")}>
            <RadioChips
              label={e("howMuchLabel")}
              value={drinkMl}
              onChange={(v) => setDrinkMl(v === drinkMl ? null : v)}
              options={CUPS.map((c) => ({ value: c.ml, label: t(`options.cups.${c.key}`), ariaLabel: e("cupAria", { label: t(`options.cups.${c.key}`), amount: formatVolume(c.ml, unit) }) }))}
            />
          </Group>
        </>
      )}

      {ctx.detailsEl && isMealLike &&
        createPortal(
          <>
            <label className="flex items-center justify-between gap-3 min-h-touch-min">
              <span className="flex flex-col">
                <span className="text-body font-extrabold">{e("newFood")}</span>
                <span className="text-caption text-muted-foreground">{e("newFoodHint")}</span>
              </span>
              <input type="checkbox" role="switch" checked={newFood} onChange={(ev) => setNewFood(ev.target.checked)} className="switch" />
            </label>
            <Group label={e("foodGroups")}>
              <ToggleChips
                options={FOOD_GROUPS.map((g) => ({ value: g.key, label: g.label }))}
                selected={groups}
                onToggle={(g) => setGroups((xs) => (xs.includes(g) ? xs.filter((x) => x !== g) : [...xs, g]))}
              />
            </Group>
            <Group label={e("anyReaction")}>
              <ToggleChips
                tone="warning"
                options={REACTIONS.map((r) => ({ value: r.key, label: r.label }))}
                selected={reactions}
                onToggle={(r) => setReactions((xs) => (xs.includes(r) ? xs.filter((x) => x !== r) : [...xs, r]))}
              />
            </Group>
            {reactions.includes(URGENT_REACTION) && (
              <Notice tone="urgent" role="alert" title={e("call911")} />
            )}
          </>,
          ctx.detailsEl,
        )}
    </div>
  );
}
