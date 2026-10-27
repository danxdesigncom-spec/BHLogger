"use client";

import { useState } from "react";
import type { ModuleFormContext } from "../LogSheet";
import { useHousehold } from "@/lib/context/household-provider";

type BmType = "pee" | "bm" | "both";
type Consistency = 1 | 2 | 3 | 4 | 5 | 6 | 7 | "not_sure";

const CONSISTENCY_LABELS: Record<string | number, string> = {
  1: "1 – Hard lumps",
  2: "2 – Lumpy",
  3: "3 – Cracked",
  4: "4 – Smooth",
  5: "5 – Soft blobs",
  6: "6 – Fluffy",
  7: "7 – Watery",
  not_sure: "Not sure",
};

// Wording adapts to care stage (PRD Appendix A)
function tileLabel(bmType: BmType, isBaby: boolean) {
  if (bmType === "pee") return isBaby ? "Wet" : "Pee";
  if (bmType === "bm")  return isBaby ? "Dirty" : "BM";
  return isBaby ? "Both" : "Both";
}

interface Props {
  ctx: ModuleFormContext;
}

export function BathroomSheet({ ctx }: Props) {
  const { profiles, activeProfileId } = useHousehold();
  const profile = profiles.find((p) => p.id === activeProfileId);
  const isBaby = profile?.careStage === "baby";
  const usesDiapers = profile?.careStage === "baby";

  const [bmType, setBmType] = useState<BmType | null>(null);
  const [consistency, setConsistency] = useState<Consistency | null>(null);

  const selectType = (t: BmType) => {
    setBmType(t);
    const needsConsistency = t === "bm" || t === "both";
    const data: Record<string, unknown> = {
      type: t,
      ...(needsConsistency && consistency ? { consistency } : {}),
    };
    const summary = tileLabel(t, isBaby);
    ctx.setData(data, summary);
  };

  const selectConsistency = (c: Consistency) => {
    setConsistency(c);
    if (bmType) {
      ctx.setData({ type: bmType, consistency: c }, tileLabel(bmType, isBaby));
    }
  };

  const needsConsistency = bmType === "bm" || bmType === "both";

  return (
    <div className="space-y-4">
      {/* Type selector */}
      <div>
        <p className="text-[13px] font-extrabold text-muted-foreground mb-2 uppercase tracking-wide">
          {usesDiapers ? "Diaper type" : "Type"}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(["pee", "bm", "both"] as BmType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => selectType(t)}
              className={[
                "min-h-[56px] flex items-center justify-center rounded-[18px] text-[15px] font-extrabold border-[1.5px] transition-colors",
                bmType === t
                  ? "bg-[var(--module-bathroom)] border-[var(--module-bathroom-ink)] text-[var(--module-bathroom-ink)]"
                  : "bg-white border-[var(--color-border)] text-foreground",
              ].join(" ")}
            >
              {tileLabel(t, isBaby)}
            </button>
          ))}
        </div>
      </div>

      {/* Consistency (only for BM / Both) */}
      {needsConsistency && (
        <div>
          <p className="text-[13px] font-extrabold text-muted-foreground mb-2 uppercase tracking-wide">
            Consistency (Bristol)
          </p>
          <div className="grid grid-cols-2 gap-2">
            {([1, 2, 3, 4, 5, 6, 7, "not_sure"] as Consistency[]).map((c) => (
              <button
                key={String(c)}
                type="button"
                onClick={() => selectConsistency(c)}
                className={[
                  "min-h-[44px] px-3 flex items-center justify-center rounded-[14px] text-[13px] font-bold border-[1.5px] transition-colors text-center",
                  consistency === c
                    ? "bg-[var(--module-bathroom)] border-[var(--module-bathroom-ink)] text-[var(--module-bathroom-ink)]"
                    : "bg-white border-[var(--color-border)] text-foreground",
                ].join(" ")}
              >
                {CONSISTENCY_LABELS[String(c)]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
