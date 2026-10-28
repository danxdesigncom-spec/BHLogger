"use client";

import { useState } from "react";
import { Check, Minus, Plus } from "lucide-react";
import type { ModuleFormContext } from "../LogSheet";
import { useHousehold } from "@/lib/context/household-provider";
import { useLatestEntry } from "@/lib/hooks/useLatestEntry";

type HowFed = "breast" | "bottle" | "solids";
type BottleContent = "breast_milk" | "formula" | "other";

// 1 oz = 29.574 ml (PRD: store in ml, display in oz)
const OZ_TO_ML = 29.574;

const OZ_CHIPS = [2, 3, 4, 5, 6, 8];
const MIN_OZ = 0.5;
const MAX_OZ = 16;
const STEP_OZ = 0.5;

const PILL_SEL = "bg-[var(--color-profile)] border-[var(--color-profile)] text-white";
const PILL_OFF = "bg-[var(--color-secondary)] border-[var(--color-border)] text-foreground";

interface Props { ctx: ModuleFormContext }

export function FeedingSheet({ ctx }: Props) {
  const { profiles, activeProfileId } = useHousehold();
  const profile = profiles.find((p) => p.id === activeProfileId);
  const { data: lastEntry } = useLatestEntry(activeProfileId ?? null, "eating");

  // Last feed amount in oz (for "Same as last feed" hint)
  const lastOz = (() => {
    if (!lastEntry) return null;
    const d = (lastEntry as { data?: { amountMl?: number } }).data;
    if (d?.amountMl) return Math.round((d.amountMl / OZ_TO_ML) * 2) / 2;
    return null;
  })();

  const [how, setHow] = useState<HowFed>("bottle");
  const [bottleContent, setBottleContent] = useState<BottleContent>("formula");
  const [amountOz, setAmountOz] = useState<number>(lastOz ?? 4);

  if (profile?.careStage !== "baby") return null;

  const push = (overrides: Record<string, unknown> = {}) => {
    const h = (overrides.how as HowFed) ?? how;
    const bc = (overrides.bottleContent as BottleContent) ?? bottleContent;
    const oz = (overrides.amountOz as number) ?? amountOz;
    const data: Record<string, unknown> = { how: h };
    if (h === "bottle") {
      data.bottleContent = bc;
      data.amountMl = Math.round(oz * OZ_TO_ML);
    }
    ctx.setData(data, h === "breast" ? "Breast" : h === "solids" ? "Solids" : `${oz} oz`);
  };

  const stepAmount = (delta: number) => {
    setAmountOz((prev) => {
      const next = Math.max(MIN_OZ, Math.min(MAX_OZ, Math.round((prev + delta) / STEP_OZ) * STEP_OZ));
      push({ amountOz: next });
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* How? */}
      <div>
        <h2 className="text-[14px] font-extrabold text-muted-foreground mb-2">How?</h2>
        <div className="grid grid-cols-3 gap-2">
          {([
            { key: "breast" as HowFed, label: "Breast", sub: "Start on right" },
            { key: "bottle" as HowFed, label: "Bottle", sub: null },
            { key: "solids" as HowFed, label: "Solids", sub: null },
          ]).map(({ key, label, sub }) => {
            const sel = how === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={sel}
                onClick={() => { setHow(key); push({ how: key }); }}
                className={`min-h-[64px] flex flex-col items-center justify-center gap-0.5 rounded-[18px] border-[1.5px] cursor-pointer transition-colors ${sel ? PILL_SEL : PILL_OFF}`}
              >
                <span className="text-[17px] font-extrabold flex items-center gap-1.5">
                  {sel && <Check size={16} strokeWidth={3} />}
                  {label}
                </span>
                {sub && (
                  <span className={`text-[12.5px] font-bold ${sel ? "text-white/80" : "text-muted-foreground"}`}>
                    {sub}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* What's in the bottle? */}
      {how === "bottle" && (
        <>
          <div>
            <h2 className="text-[14px] font-extrabold text-muted-foreground mb-2">What&rsquo;s in the bottle?</h2>
            <div className="flex gap-2">
              {([
                { key: "breast_milk" as BottleContent, label: "Breast milk" },
                { key: "formula"    as BottleContent, label: "Formula" },
                { key: "other"      as BottleContent, label: "Other" },
              ]).map(({ key, label }) => {
                const sel = bottleContent === key;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={sel}
                    onClick={() => { setBottleContent(key); push({ bottleContent: key }); }}
                    className={`min-h-[44px] px-4 flex items-center gap-1.5 rounded-full border font-bold text-[15px] cursor-pointer transition-colors ${sel ? PILL_SEL : PILL_OFF}`}
                  >
                    {sel && <Check size={14} strokeWidth={3} />}
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* How much? */}
          <div>
            <h2 className="text-[14px] font-extrabold text-muted-foreground mb-2">How much?</h2>
            {/* Stepper */}
            <div className="grid grid-cols-[56px_1fr_56px] items-center gap-3 p-3 rounded-[24px] bg-[var(--color-secondary)]">
              <button
                type="button"
                aria-label="Less"
                onClick={() => stepAmount(-STEP_OZ)}
                disabled={amountOz <= MIN_OZ}
                className="w-14 h-14 border-none rounded-full bg-[var(--color-card)] shadow-sm flex items-center justify-center cursor-pointer disabled:opacity-40"
              >
                <Minus size={22} strokeWidth={2} />
              </button>
              <div className="flex flex-col items-center gap-0.5">
                <span className="font-display text-[32px] font-semibold leading-tight">{amountOz} oz</span>
                {lastOz !== null && (
                  <span className="text-[13px] font-bold text-muted-foreground">Same as last feed</span>
                )}
              </div>
              <button
                type="button"
                aria-label="More"
                onClick={() => stepAmount(STEP_OZ)}
                disabled={amountOz >= MAX_OZ}
                className="w-14 h-14 border-none rounded-full bg-[var(--color-card)] shadow-sm flex items-center justify-center cursor-pointer disabled:opacity-40"
              >
                <Plus size={22} strokeWidth={2} />
              </button>
            </div>
            {/* Quick chips */}
            <div className="grid grid-cols-6 gap-1.5 mt-2">
              {OZ_CHIPS.map((oz) => {
                const sel = amountOz === oz;
                return (
                  <button
                    key={oz}
                    type="button"
                    aria-pressed={sel}
                    onClick={() => { setAmountOz(oz); push({ amountOz: oz }); }}
                    className={`min-h-[44px] flex items-center justify-center rounded-full border text-[14px] font-bold cursor-pointer transition-colors ${sel ? PILL_SEL : PILL_OFF}`}
                  >
                    {oz} oz
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
