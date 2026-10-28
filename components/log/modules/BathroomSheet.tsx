"use client";

import { useState } from "react";
import { Check, Flag } from "lucide-react";
import type { ModuleFormContext } from "../LogSheet";
import { useHousehold } from "@/lib/context/household-provider";

// ─── Types ────────────────────────────────────────────────────────────────────

type ToiletType = "pee" | "bm" | "both";
type DiaperType = "wet" | "dirty" | "both" | "dry";
type BristolType = 1 | 2 | 3 | 4 | 5 | 6 | 7 | "not_sure";
type InfantConsistency = "watery" | "soft" | "formed" | "hard";
type StoolColor = "yellow" | "green" | "brown" | "black" | "red" | "pale" | "other";

const CALM_COLORS = new Set<StoolColor>(["red", "black", "pale"]);

// ─── Shared Tailwind class helpers ───────────────────────────────────────────

const PILL_SEL = "bg-[var(--color-profile)] border-[var(--color-profile)] text-white";
const PILL_OFF = "bg-[var(--color-secondary)] border-[var(--color-border)] text-foreground";
const TILE_SEL = "relative bg-[var(--color-profile-tint)] border-2 border-[var(--color-profile)] text-foreground";
const TILE_OFF = "bg-[var(--color-secondary)] border-[1.5px] border-[var(--color-border)] text-foreground";

// ─── Bristol stool scale SVGs (exact from design mockup) ─────────────────────

const BRISTOL: { svg: string; label: string }[] = [
  { svg: '<circle cx="10" cy="12" r="4"/><circle cx="20" cy="12" r="4"/><circle cx="30" cy="12" r="4"/>', label: "Hard lumps" },
  { svg: '<path d="M8 8h24a4 4 0 0 1 0 8H8a4 4 0 0 1 0-8z"/><path d="M14 8v8M20 8v8M26 8v8"/>', label: "Lumpy" },
  { svg: '<path d="M8 8h24a4 4 0 0 1 0 8H8a4 4 0 0 1 0-8z"/><path d="M15 8l1.5 3M23 8l1.5 3"/>', label: "Cracked" },
  { svg: '<path d="M8 8h24a4 4 0 0 1 0 8H8a4 4 0 0 1 0-8z"/>', label: "Smooth" },
  { svg: '<ellipse cx="12" cy="12" rx="6" ry="4.5"/><ellipse cx="27" cy="12" rx="7" ry="5"/>', label: "Soft blobs" },
  { svg: '<path d="M9 17c-3 0-3.5-4.5 0-5 0-3.5 4.5-4.5 6.5-2.5 1.5-3 7.5-3 8.5 0 2.5-2 6.5-.5 6.5 2.5 3.5 0 4 5 0 5z"/>', label: "Mushy" },
  { svg: '<path d="M5 10c3-2.5 6 2.5 9 0s6 2.5 9 0 6 2.5 9 0"/><path d="M5 16c3-2.5 6 2.5 9 0s6 2.5 9 0 6 2.5 9 0"/>', label: "Watery" },
];

const INFANT_SCALE: { key: InfantConsistency; svg: string; label: string }[] = [
  { key: "watery",  svg: '<path d="M5 10c3-2.5 6 2.5 9 0s6 2.5 9 0 6 2.5 9 0"/><path d="M5 16c3-2.5 6 2.5 9 0s6 2.5 9 0 6 2.5 9 0"/>', label: "Watery" },
  { key: "soft",    svg: '<path d="M10 18c-4 0-4.5-5.5 0-6 0-4 5-5 7.5-2.5 2-3 8.5-3 9.5 1 3.5-.5 6 5.5 1 7.5z"/>', label: "Soft" },
  { key: "formed",  svg: '<path d="M8 8h24a4 4 0 0 1 0 8H8a4 4 0 0 1 0-8z"/>', label: "Formed" },
  { key: "hard",    svg: '<circle cx="10" cy="12" r="4"/><circle cx="20" cy="12" r="4"/><circle cx="30" cy="12" r="4"/>', label: "Hard" },
];

// ─── Stool color swatches ─────────────────────────────────────────────────────
// These visual representation colors are not UI theme colors so they use direct hex values.

const COLORS: { key: StoolColor; label: string; swatch: string; border?: string }[] = [
  { key: "yellow", label: "Yellow", swatch: "#E3B53B" },
  { key: "green",  label: "Green",  swatch: "#5E7F2A" },
  { key: "brown",  label: "Brown",  swatch: "#7B4B2A" },
  { key: "black",  label: "Black",  swatch: "#2A2522" },
  { key: "red",    label: "Red",    swatch: "#B42318" },
  { key: "pale",   label: "Pale",   swatch: "#EDE7D9", border: "#B9AE95" },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface Props { ctx: ModuleFormContext }

export function BathroomSheet({ ctx }: Props) {
  const { profiles, activeProfileId } = useHousehold();
  const profile = profiles.find((p) => p.id === activeProfileId);
  const isBaby = profile?.careStage === "baby";
  const name = profile?.name ?? "they";

  // Diaper state
  const [diaperType, setDiaperType]             = useState<DiaperType | null>(null);
  const [infantConsistency, setInfantConsistency] = useState<InfantConsistency | null>(null);

  // Toilet state
  const [toiletType, setToiletType]             = useState<ToiletType | null>(null);
  const [where, setWhere]                       = useState<"toilet" | "accident">("toilet");
  const [bristol, setBristol]                   = useState<BristolType | null>(null);

  // Shared
  const [color, setColor] = useState<StoolColor | null>(null);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const push = (overrides: Record<string, unknown>, summaryOverride?: string) => {
    if (isBaby) {
      const t = (overrides.diaperType as DiaperType | undefined) ?? diaperType;
      const ic = (overrides.infantConsistency as InfantConsistency | undefined) ?? infantConsistency;
      const c = (overrides.color as StoolColor | undefined) ?? color;
      const data: Record<string, unknown> = { type: t };
      if (ic) data.consistency = ic;
      if (c)  data.color = c;
      const label = t === "wet" ? "Wet" : t === "dirty" ? "Dirty" : t === "both" ? "Both" : t === "dry" ? "Dry" : "";
      ctx.setData(data, summaryOverride ?? label);
    } else {
      const t  = (overrides.toiletType as ToiletType | undefined) ?? toiletType;
      const w  = (overrides.where as string | undefined) ?? where;
      const b  = (overrides.bristol as BristolType | undefined) ?? bristol;
      const c  = (overrides.color as StoolColor | undefined) ?? color;
      const data: Record<string, unknown> = { type: t, where: w };
      if (b) data.consistency = b;
      if (c) data.color = c;
      const label = t === "pee" ? "Pee" : t === "bm" ? "BM" : "Both";
      ctx.setData(data, summaryOverride ?? label);
    }
  };

  const needsConsistency = isBaby
    ? diaperType === "dirty" || diaperType === "both"
    : toiletType === "bm"   || toiletType === "both";

  const showCalmNotice = color !== null && CALM_COLORS.has(color);

  const calmText = isBaby
    ? `Pale, white or clay-colored stool in a baby should be reported to your baby's doctor promptly, especially with yellow skin or eyes.`
    : `${name}'s stool color can sometimes indicate an issue. If you notice other symptoms, contact your care team.`;

  // ── Tile button ──────────────────────────────────────────────────────────

  function TileBtn({ isSelected, onClick, children: ch, className = "" }: {
    isSelected: boolean; onClick: () => void; children: React.ReactNode; className?: string;
  }) {
    return (
      <button
        type="button"
        aria-pressed={isSelected}
        onClick={onClick}
        className={`${isSelected ? TILE_SEL : TILE_OFF} rounded-[18px] flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors ${className}`}
      >
        {isSelected && (
          <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[var(--color-profile)] text-white flex items-center justify-center flex-none">
            <Check size={12} strokeWidth={3} />
          </span>
        )}
        {ch}
      </button>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ── Diaper: What's in the diaper? ── */}
      {isBaby && (
        <div>
          <h2 className="text-[14px] font-extrabold text-muted-foreground mb-2">What&rsquo;s in the diaper?</h2>
          <div className="grid grid-cols-4 gap-2">
            {(["wet", "dirty", "both", "dry"] as DiaperType[]).map((t) => {
              const sel = diaperType === t;
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={sel}
                  onClick={() => { setDiaperType(t); push({ diaperType: t }); }}
                  className={`min-h-[60px] flex items-center justify-center gap-1.5 rounded-[18px] border-[1.5px] text-[16px] font-extrabold cursor-pointer transition-colors ${sel ? PILL_SEL : PILL_OFF}`}
                >
                  {sel && <Check size={16} strokeWidth={3} />}
                  {t === "wet" ? "Wet" : t === "dirty" ? "Dirty" : t === "both" ? "Both" : "Dry"}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Toilet: What happened? ── */}
      {!isBaby && (
        <div>
          <h2 className="text-[14px] font-extrabold text-muted-foreground mb-2">What happened?</h2>
          <div className="grid grid-cols-3 gap-2">
            {(["pee", "bm", "both"] as ToiletType[]).map((t) => {
              const sel = toiletType === t;
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={sel}
                  onClick={() => { setToiletType(t); push({ toiletType: t }); }}
                  className={`min-h-[64px] flex items-center justify-center gap-1.5 rounded-[18px] border-[1.5px] text-[17px] font-extrabold cursor-pointer transition-colors ${sel ? PILL_SEL : PILL_OFF}`}
                >
                  {sel && <Check size={16} strokeWidth={3} />}
                  {t === "pee" ? "Pee" : t === "bm" ? "BM" : "Both"}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Toilet: Where? ── */}
      {!isBaby && (
        <div>
          <h2 className="text-[14px] font-extrabold text-muted-foreground mb-2">Where?</h2>
          <div className="flex gap-2">
            {(["toilet", "accident"] as const).map((w) => {
              const sel = where === w;
              return (
                <button
                  key={w}
                  type="button"
                  aria-pressed={sel}
                  onClick={() => { setWhere(w); push({ where: w }); }}
                  className={`min-h-[44px] px-4 flex items-center gap-1.5 rounded-full border font-bold text-[15px] cursor-pointer transition-colors ${sel ? PILL_SEL : PILL_OFF}`}
                >
                  {sel && <Check size={14} strokeWidth={3} />}
                  {w === "toilet" ? "Toilet" : "Accident"}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Consistency (only when stool is involved) ── */}
      {needsConsistency && (
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-[14px] font-extrabold text-muted-foreground">Consistency</h2>
            <span className="text-[13px] text-muted-foreground">{isBaby ? "Infant scale" : "Bristol scale, 1 to 7"}</span>
          </div>

          {/* Baby: 4-point infant scale */}
          {isBaby && (
            <div className="grid grid-cols-4 gap-2">
              {INFANT_SCALE.map(({ key, svg, label }) => {
                const sel = infantConsistency === key;
                return (
                  <TileBtn key={key} isSelected={sel} className="min-h-[76px] p-1.5" onClick={() => { setInfantConsistency(key); push({ infantConsistency: key }); }}>
                    <svg viewBox="0 0 40 24" width={40} height={24} fill="none" stroke="#6B4A2E" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />
                    <span className="text-[12.5px] font-extrabold">{label}</span>
                  </TileBtn>
                );
              })}
            </div>
          )}

          {/* Toilet: Bristol 1-7 + Not sure */}
          {!isBaby && (
            <div className="grid grid-cols-4 gap-2">
              {BRISTOL.map(({ svg, label }, i) => {
                const val = (i + 1) as 1|2|3|4|5|6|7;
                const sel = bristol === val;
                return (
                  <TileBtn key={val} isSelected={sel} className="min-h-[84px] py-1.5 px-0.5" onClick={() => { setBristol(val); push({ bristol: val }); }}>
                    <svg viewBox="0 0 40 24" width={40} height={24} fill="none" stroke="#6B4A2E" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />
                    <span className="text-[14px] font-extrabold">{val}</span>
                    <span className={`text-[12px] font-bold ${sel ? "text-[var(--color-profile)]" : "text-muted-foreground"}`}>{label}</span>
                  </TileBtn>
                );
              })}
              {/* Not sure */}
              <TileBtn isSelected={bristol === "not_sure"} className="min-h-[84px] p-1.5" onClick={() => { setBristol("not_sure"); push({ bristol: "not_sure" }); }}>
                <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-muted-foreground">
                  <circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7"/><path d="M12 17h.01"/>
                </svg>
                <span className="text-[12px] font-bold text-muted-foreground">Not sure</span>
              </TileBtn>
            </div>
          )}
        </div>
      )}

      {/* ── Color swatches ── */}
      <div>
        <h2 className="text-[14px] font-extrabold text-muted-foreground mb-2">Color</h2>
        <div className="grid grid-cols-7 gap-0.5">
          {COLORS.map(({ key, label, swatch, border }) => {
            const sel = color === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={sel}
                onClick={() => { setColor(key); push({ color: key }); }}
                className="flex flex-col items-center gap-1 p-0 border-none bg-transparent cursor-pointer"
              >
                <span
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{
                    background: swatch,
                    border: border ? `1.5px solid ${border}` : undefined,
                    boxShadow: sel ? `0 0 0 3px white, 0 0 0 5px var(--color-profile)` : undefined,
                  }}
                >
                  {sel && <Check size={16} strokeWidth={3} className="text-white drop-shadow-sm" />}
                </span>
                <span className={`text-[11.5px] ${sel ? "font-extrabold" : "font-bold"} text-foreground`}>{label}</span>
              </button>
            );
          })}
          {/* Other */}
          <button
            type="button"
            aria-pressed={color === "other"}
            onClick={() => { setColor("other"); push({ color: "other" }); }}
            className="flex flex-col items-center gap-1 p-0 border-none bg-transparent cursor-pointer"
          >
            <span
              className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground"
              style={{
                background: "white",
                border: color === "other" ? `2px solid var(--color-profile)` : "1.5px dashed #9C93B5",
                boxShadow: color === "other" ? `0 0 0 3px white, 0 0 0 5px var(--color-profile)` : undefined,
              }}
            >
              {color !== "other"
                ? <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
                : <Check size={16} strokeWidth={3} className="text-[var(--color-profile)]" />
              }
            </span>
            <span className="text-[11.5px] font-bold text-foreground">Other</span>
          </button>
        </div>
      </div>

      {/* ── Calm notice (BTH-06) ── */}
      {showCalmNotice && (
        <div
          role="note"
          className="flex flex-col gap-2.5 p-3.5 rounded-[18px] border"
          style={{
            background: "var(--color-warning)",
            borderColor: "var(--color-warning-border)",
            color: "var(--color-warning-ink)",
          }}
        >
          <div className="flex items-start gap-2.5">
            <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="flex-none mt-0.5" aria-hidden="true">
              <circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>
            </svg>
            <div className="flex flex-col gap-1">
              <span className="text-[15px] font-extrabold">Worth a call to {name}&rsquo;s doctor</span>
              <span className="text-[14px] leading-snug">{calmText}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => ctx.setFlagged(true)}
            className="self-start min-h-[44px] flex items-center gap-1.5 px-4 rounded-full border-[1.5px] text-[14px] font-extrabold cursor-pointer bg-white transition-opacity active:opacity-75"
            style={{ borderColor: "var(--color-warning-border)", color: "var(--color-warning-ink)" }}
          >
            <Flag size={16} strokeWidth={2} />
            Flag for doctor
          </button>
        </div>
      )}
    </div>
  );
}
