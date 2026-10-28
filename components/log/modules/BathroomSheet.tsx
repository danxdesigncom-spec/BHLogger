"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Flag, HelpCircle, Plus } from "lucide-react";
import type { ModuleFormContext } from "../LogSheet";
import { Group, Notice, OptionTiles, RadioChips, ToggleChips } from "../controls";
import { useHousehold } from "@/lib/context/household-provider";
import {
  absorbentLabel, ageInDays, bathroomKindLabel, bathroomKinds, BM_FLAGS, BM_SIZES, BRISTOL, defaultStoolScale,
  INFANT_CONSISTENCY, isNoticeColor, STOOL_COLORS, type BathroomKind,
} from "@/lib/options";

const STOOL_ICON: Record<string, string> = {
  bristol1: '<circle cx="10" cy="12" r="4"/><circle cx="20" cy="12" r="4"/><circle cx="30" cy="12" r="4"/>',
  bristol2: '<path d="M8 8h24a4 4 0 0 1 0 8H8a4 4 0 0 1 0-8z"/><path d="M14 8v8M20 8v8M26 8v8"/>',
  bristol3: '<path d="M8 8h24a4 4 0 0 1 0 8H8a4 4 0 0 1 0-8z"/><path d="M15 8l1.5 3M23 8l1.5 3"/>',
  bristol4: '<path d="M8 8h24a4 4 0 0 1 0 8H8a4 4 0 0 1 0-8z"/>',
  bristol5: '<ellipse cx="12" cy="12" rx="6" ry="4.5"/><ellipse cx="27" cy="12" rx="7" ry="5"/>',
  bristol6: '<path d="M9 17c-3 0-3.5-4.5 0-5 0-3.5 4.5-4.5 6.5-2.5 1.5-3 7.5-3 8.5 0 2.5-2 6.5-.5 6.5 2.5 3.5 0 4 5 0 5z"/>',
  bristol7: '<path d="M5 10c3-2.5 6 2.5 9 0s6 2.5 9 0 6 2.5 9 0"/><path d="M5 16c3-2.5 6 2.5 9 0s6 2.5 9 0 6 2.5 9 0"/>',
  watery: '<path d="M5 10c3-2.5 6 2.5 9 0s6 2.5 9 0 6 2.5 9 0"/><path d="M5 16c3-2.5 6 2.5 9 0s6 2.5 9 0 6 2.5 9 0"/>',
  soft: '<path d="M10 18c-4 0-4.5-5.5 0-6 0-4 5-5 7.5-2.5 2-3 8.5-3 9.5 1 3.5-.5 6 5.5 1 7.5z"/>',
  formed: '<path d="M8 8h24a4 4 0 0 1 0 8H8a4 4 0 0 1 0-8z"/>',
  hard: '<circle cx="10" cy="12" r="4"/><circle cx="20" cy="12" r="4"/><circle cx="30" cy="12" r="4"/>',
};

function StoolIcon({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 40 24" width={40} height={24} fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-stool-brown"
      dangerouslySetInnerHTML={{ __html: STOOL_ICON[name] }}
    />
  );
}

const SWATCH: Record<string, string> = {
  yellow: "bg-stool-yellow", green: "bg-stool-green", brown: "bg-stool-brown", black: "bg-stool-black",
  red: "bg-stool-red", white_pale_clay: "bg-stool-pale border-[1.5px] border-stool-pale-border",
};

type Consistency = number | string;

export function BathroomSheet({ ctx }: { ctx: ModuleFormContext }) {
  const { activeProfile } = useHousehold();
  const stage = activeProfile?.careStage ?? "child";
  const toileting = activeProfile?.toileting ?? "toilet";
  const ageDays = ageInDays(activeProfile?.dob ?? null);

  const [kind, setKind] = useState<BathroomKind | null>(null);
  const [location, setLocation] = useState<"diaper" | "toilet" | "accident">(toileting === "diapers" ? "diaper" : "toilet");
  const [scale, setScale] = useState<"aiss" | "bristol">(defaultStoolScale(stage, toileting));
  const [consistency, setConsistency] = useState<Consistency | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [flags, setFlags] = useState<string[]>([]);

  const hasStool = kind === "bm" || kind === "both";

  useEffect(() => {
    if (!kind) return;
    const data: Record<string, unknown> = { kind, location, flags };
    if (hasStool) {
      if (consistency !== null && consistency !== "not_sure") Object.assign(data, { scale, consistency });
      if (color) data.color = color;
      if (size) data.size = size;
    }
    const label = bathroomKindLabel(kind, toileting);
    const summary = toileting === "diapers" ? (kind === "dry" ? "Dry diaper" : `${label} diaper`) : label;
    ctx.setData(data, summary, true);
    // ctx.setData is stable; the effect re-runs only when the form changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, location, scale, consistency, color, size, flags, hasStool, toileting]);

  const showNotice = hasStool && (isNoticeColor(color ?? undefined, ageDays) || flags.includes("blood"));
  const babyPale = stage === "baby" && color === "white_pale_clay";

  const locations =
    toileting === "training"
      ? [{ value: "diaper" as const, label: absorbentLabel(stage, toileting) }, { value: "toilet" as const, label: "Toilet" }, { value: "accident" as const, label: "Accident" }]
      : [{ value: "toilet" as const, label: "Toilet" }, { value: "accident" as const, label: "Accident" }];

  return (
    <div className="space-y-4">
      <Group label={toileting === "diapers" ? `What's in the ${absorbentLabel(stage, toileting).toLowerCase()}?` : "What happened?"}>
        <RadioChips
          label="What happened"
          variant="block"
          value={kind}
          onChange={setKind}
          options={bathroomKinds(toileting).map((k) => ({ value: k, label: bathroomKindLabel(k, toileting) }))}
        />
      </Group>

      {toileting !== "diapers" && (
        <Group label="Where?">
          <RadioChips label="Where" value={location} onChange={setLocation} options={locations} />
        </Group>
      )}

      {hasStool && (
        <Group
          label="Consistency"
          hint={
            <button
              type="button"
              className="underline underline-offset-2"
              onClick={() => { setScale(scale === "aiss" ? "bristol" : "aiss"); setConsistency(null); }}
            >
              {scale === "aiss" ? "Infant scale · switch" : "Bristol 1 to 7 · switch"}
            </button>
          }
        >
          {scale === "aiss" ? (
            <OptionTiles
              label="Consistency"
              value={consistency}
              onChange={setConsistency}
              options={INFANT_CONSISTENCY.map((c) => ({ value: c.key, label: c.label, icon: <StoolIcon name={c.key} /> }))}
            />
          ) : (
            <OptionTiles
              label="Consistency, Bristol scale"
              minHeight={84}
              value={consistency}
              onChange={setConsistency}
              options={[
                ...BRISTOL.map((b) => ({
                  value: b.type as Consistency, label: String(b.type), sub: b.short,
                  ariaLabel: `Type ${b.type}: ${b.full}`, icon: <StoolIcon name={`bristol${b.type}`} />,
                })),
                { value: "not_sure", label: "Not sure", icon: <HelpCircle size={24} strokeWidth={2} className="text-muted-foreground" aria-hidden="true" /> },
              ]}
            />
          )}
        </Group>
      )}

      {hasStool && (
        <Group label="Color">
          <div role="radiogroup" aria-label="Color" className="grid grid-cols-7 gap-0.5">
            {STOOL_COLORS.map((c) => {
              const sel = color === c.key;
              return (
                <button
                  key={c.key}
                  type="button"
                  role="radio"
                  aria-checked={sel}
                  aria-label={c.key === "white_pale_clay" ? "White, pale or clay" : c.label}
                  onClick={() => setColor(sel ? null : c.key)}
                  className="flex flex-col items-center gap-1 py-0.5"
                >
                  <span
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      c.key === "other" ? "bg-card border-[1.5px] border-dashed border-dashed-line text-muted-foreground" : SWATCH[c.key]
                    }`}
                    style={sel ? { boxShadow: "0 0 0 3px var(--card), 0 0 0 5px var(--profile)" } : undefined}
                  >
                    {sel ? (
                      <Check size={16} strokeWidth={3} className={c.key === "white_pale_clay" || c.key === "yellow" || c.key === "other" ? "text-foreground" : "text-white"} aria-hidden="true" />
                    ) : c.key === "other" ? (
                      <Plus size={16} strokeWidth={2} aria-hidden="true" />
                    ) : null}
                  </span>
                  <span className={`text-micro ${sel ? "font-extrabold" : "font-bold"}`}>{c.label}</span>
                </button>
              );
            })}
          </div>
        </Group>
      )}

      {showNotice && (
        <Notice
          tone="warning"
          title="Worth mentioning to your doctor"
          action={
            <button
              type="button"
              aria-pressed={ctx.flagged}
              onClick={() => ctx.setFlagged(!ctx.flagged)}
              className="self-start min-h-touch-min flex items-center gap-1.5 px-4 rounded-full border-[1.5px] border-warning-border bg-card text-label font-extrabold text-warning-ink"
            >
              {ctx.flagged ? <Check size={16} strokeWidth={2.5} aria-hidden="true" /> : <Flag size={16} strokeWidth={2} aria-hidden="true" />}
              {ctx.flagged ? "Flagged for doctor" : "Flag for doctor"}
            </button>
          }
        >
          {babyPale
            ? "Pale, white or clay-colored stool in a baby should be reported to your baby's doctor promptly, especially with yellow skin or eyes."
            : undefined}
        </Notice>
      )}

      {ctx.detailsEl && hasStool &&
        createPortal(
          <>
            <Group label="Size">
              <RadioChips label="Size" value={size} onChange={(v) => setSize(v === size ? null : v)} options={BM_SIZES.map((s) => ({ value: s.key, label: s.label }))} />
            </Group>
            <Group label="Anything else?">
              <ToggleChips
                options={BM_FLAGS.filter((f) => toileting === "diapers" || !["diaper_rash", "blowout_leak"].includes(f.key)).map((f) => ({ value: f.key, label: f.label }))}
                selected={flags}
                onToggle={(f) => setFlags((xs) => (xs.includes(f) ? xs.filter((x) => x !== f) : [...xs, f]))}
              />
            </Group>
          </>,
          ctx.detailsEl,
        )}
    </div>
  );
}
