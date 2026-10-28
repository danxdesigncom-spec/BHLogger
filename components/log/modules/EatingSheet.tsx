"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { ModuleFormContext } from "../LogSheet";
import { Group, Notice, OptionTiles, RadioChips, Stepper, ToggleChips } from "../controls";
import { useHousehold } from "@/lib/context/household-provider";
import { useLatestEntry } from "@/lib/data/hooks";
import {
  ageInMonths, BOTTLE_CONTENTS, BREAST_DURATIONS, BREAST_SIDES, DRINKS, eatingMethodLabel, eatingMethods, FOOD_GROUPS,
  formatVolume, mealTypeForHour, MEAL_TYPES, ML_CHIPS, mlToOz, OZ_CHIPS, ozToMl, PORTIONS, REACTIONS, URGENT_REACTION,
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
  { ml: 118, label: "½ cup" },
  { ml: 237, label: "1 cup" },
  { ml: 473, label: "2 cups" },
];

type D = Record<string, unknown>;

export function EatingSheet({ ctx }: { ctx: ModuleFormContext }) {
  const { activeProfile, householdSettings } = useHousehold();
  const profileId = activeProfile?.id ?? null;
  const stage = activeProfile?.careStage ?? "child";
  const unit = householdSettings.volume_unit;
  const methods = eatingMethods(stage, activeProfile?.feedingMethods ?? [], ageInMonths(activeProfile?.dob ?? null));

  const last = useLatestEntry(profileId, "eating");
  const lastBottle = useLatestEntry(profileId, "eating", { method: "bottle" });
  const lastBreast = useLatestEntry(profileId, "eating", { method: "breast" });

  const lastMethod = (last.data?.data as D | undefined)?.method as EatingMethod | undefined;
  const lastSide = (lastBreast.data?.data as D | undefined)?.side as string | undefined;
  const startSide = lastSide === "left" ? "right" : lastSide === "right" ? "left" : "left";
  const lastBottleData = lastBottle.data?.data as D | undefined;
  const lastAmountMl = typeof lastBottleData?.amount_ml === "number" ? lastBottleData.amount_ml : null;

  const [method, setMethod] = useState<EatingMethod>(methods[0]);
  const [touchedMethod, setTouchedMethod] = useState(false);
  const [side, setSide] = useState<string>("left");
  const [touchedSide, setTouchedSide] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  const [contents, setContents] = useState<string | null>(null);
  const [amountMl, setAmountMl] = useState<number | null>(null);
  const [mealType, setMealType] = useState(mealTypeForHour(new Date().getHours()));
  const [portion, setPortion] = useState<number | null>(null);
  const [drink, setDrink] = useState("water");
  const [drinkMl, setDrinkMl] = useState<number | null>(null);
  const [groups, setGroups] = useState<string[]>([]);
  const [reactions, setReactions] = useState<string[]>([]);

  // QL-06: preselect last-used method, breast start side and bottle amount once they load.
  const effMethod = touchedMethod ? method : lastMethod && methods.includes(lastMethod) ? lastMethod : method;
  const effSide = touchedSide ? side : startSide;
  const effContents = contents ?? ((lastBottleData?.contents as string | undefined) ?? "formula");
  const effAmount = amountMl ?? lastAmountMl ?? (unit === "oz" ? ozToMl(4) : 120);

  useEffect(() => {
    let data: D;
    let summary: string;
    switch (effMethod) {
      case "breast":
        data = { method: "breast", side: effSide, ...(duration ? { duration_min: duration } : {}) };
        summary = `Breastfeed, ${effSide}`;
        break;
      case "bottle":
        data = { method: "bottle", contents: effContents, amount_ml: effAmount };
        summary = `Bottle ${formatVolume(effAmount, unit)}`;
        break;
      case "drink":
        data = { method: "drink", contents: drink, ...(drinkMl ? { amount_ml: drinkMl } : {}) };
        summary = DRINKS.find((d) => d.key === drink)?.label ?? "Drink";
        break;
      default: {
        const isMeal = effMethod === "meal";
        data = {
          method: effMethod, ...(isMeal ? { meal_type: mealType } : {}), ...(portion !== null ? { portion_pct: portion } : {}),
          food_groups: groups, food_ids: [], new_food: false, reactions,
        };
        summary = isMeal ? (stage === "baby" ? "Solids" : MEAL_TYPES.find((m) => m.key === mealType)!.label) : "Snack";
      }
    }
    ctx.setData(data, summary, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effMethod, effSide, duration, effContents, effAmount, mealType, portion, drink, drinkMl, groups, reactions, unit, stage]);

  const amountChips = unit === "oz" ? OZ_CHIPS.map((oz) => ({ ml: ozToMl(oz), label: `${oz} oz` })) : ML_CHIPS.map((ml) => ({ ml, label: `${ml} ml` }));
  const step = unit === "oz" ? ozToMl(0.5) : 10;
  const sameAsLast = lastAmountMl !== null && Math.abs(effAmount - lastAmountMl) < 2;
  const isMealLike = effMethod === "meal" || effMethod === "snack";

  return (
    <div className="space-y-4">
      <Group label="How?">
        <RadioChips
          label="How"
          variant="block"
          columns={Math.min(methods.length, 3)}
          value={effMethod}
          onChange={(m) => { setMethod(m); setTouchedMethod(true); }}
          options={methods.map((m) => ({
            value: m,
            label: eatingMethodLabel(m, stage),
            sub: m === "breast" && lastSide ? `Start on ${startSide}` : undefined,
          }))}
        />
      </Group>

      {effMethod === "breast" && (
        <>
          <Group label="Side" hint={lastSide ? `Last: ${lastSide}` : undefined}>
            <RadioChips label="Side" value={effSide} onChange={(s) => { setSide(s); setTouchedSide(true); }} options={BREAST_SIDES.map((s) => ({ value: s.key, label: s.label }))} />
          </Group>
          <Group label="How long?">
            <RadioChips
              label="How long"
              value={duration}
              onChange={(d) => setDuration(d === duration ? null : d)}
              options={BREAST_DURATIONS.map((d) => ({ value: d, label: `${d} min` }))}
            />
          </Group>
        </>
      )}

      {effMethod === "bottle" && (
        <>
          <Group label="What's in the bottle?">
            <RadioChips label="Bottle contents" value={effContents} onChange={setContents} options={BOTTLE_CONTENTS.map((c) => ({ value: c.key, label: c.label }))} />
          </Group>
          <Group label="How much?">
            <Stepper
              display={formatVolume(effAmount, unit)}
              caption={sameAsLast ? "Same as last feed" : undefined}
              onDecrease={() => setAmountMl(Math.max(step, effAmount - step))}
              onIncrease={() => setAmountMl(Math.min(ozToMl(16), effAmount + step))}
              canDecrease={effAmount > step}
            />
            <div role="radiogroup" aria-label="Amount" className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${amountChips.length}, minmax(0, 1fr))` }}>
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
        <Group label="Which meal?">
          <RadioChips label="Which meal" value={mealType} onChange={setMealType} options={MEAL_TYPES.map((m) => ({ value: m.key, label: m.label }))} />
        </Group>
      )}

      {isMealLike && (
        <Group label="How much was eaten?">
          <OptionTiles
            label="How much was eaten"
            columns={5}
            value={portion}
            onChange={(p) => setPortion(p === portion ? null : p)}
            options={PORTIONS.map((p) => ({ value: p.pct, label: p.label, ariaLabel: `${p.label}, ${p.pct}%`, icon: <Plate pct={p.pct} /> }))}
          />
        </Group>
      )}

      {effMethod === "drink" && (
        <>
          <Group label="What?">
            <RadioChips label="Drink" value={drink} onChange={setDrink} options={DRINKS.map((d) => ({ value: d.key, label: d.label }))} />
          </Group>
          <Group label="How much?">
            <RadioChips
              label="How much"
              value={drinkMl}
              onChange={(v) => setDrinkMl(v === drinkMl ? null : v)}
              options={CUPS.map((c) => ({ value: c.ml, label: c.label, ariaLabel: `${c.label}, ${formatVolume(c.ml, unit)}` }))}
            />
          </Group>
        </>
      )}

      {ctx.detailsEl && isMealLike &&
        createPortal(
          <>
            <Group label="Food groups">
              <ToggleChips
                options={FOOD_GROUPS.map((g) => ({ value: g.key, label: g.label }))}
                selected={groups}
                onToggle={(g) => setGroups((xs) => (xs.includes(g) ? xs.filter((x) => x !== g) : [...xs, g]))}
              />
            </Group>
            <Group label="Any reaction?">
              <ToggleChips
                tone="warning"
                options={REACTIONS.map((r) => ({ value: r.key, label: r.label }))}
                selected={reactions}
                onToggle={(r) => setReactions((xs) => (xs.includes(r) ? xs.filter((x) => x !== r) : [...xs, r]))}
              />
            </Group>
            {reactions.includes(URGENT_REACTION) && (
              <Notice tone="urgent" role="alert" title="If this is happening now, call 911." />
            )}
          </>,
          ctx.detailsEl,
        )}
    </div>
  );
}
