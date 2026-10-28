"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { AlertTriangle, Check, ChevronDown, Info, Minus, Plus } from "lucide-react";

// ─── Group ───────────────────────────────────────────────────────────────────

export function Group({ label, hint, children, id }: { label: string; hint?: ReactNode; children: ReactNode; id?: string }) {
  const labelId = id ?? `grp-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <section aria-labelledby={labelId} className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id={labelId} className="font-sans text-label text-muted-foreground">{label}</h3>
        {hint && <span className="text-caption text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

// ─── Roving-focus radio group ────────────────────────────────────────────────

function useRadioKeys<T>(values: T[], value: T | null, onChange: (v: T) => void) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (e: KeyboardEvent, i: number) => {
    const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (i + delta + values.length) % values.length;
    onChange(values[next]);
    refs.current[next]?.focus();
  };
  const tabIndex = (i: number) => {
    const sel = values.findIndex((v) => v === value);
    return (sel === -1 ? i === 0 : sel === i) ? 0 : -1;
  };
  return { refs, onKeyDown, tabIndex };
}

const SEL = "bg-profile border-profile text-on-profile";
const OFF = "bg-secondary border-border text-foreground";

export interface ChoiceOption<T> {
  value: T;
  label: string;
  sub?: string;
  ariaLabel?: string;
}

/** Single-select. "block": large 60–64 px buttons in a grid. "chip": wrapping pills. */
export function RadioChips<T extends string | number>({
  label, options, value, onChange, variant = "chip", columns,
}: {
  label: string;
  options: ChoiceOption<T>[];
  value: T | null;
  onChange: (v: T) => void;
  variant?: "chip" | "block";
  columns?: number;
}) {
  const { refs, onKeyDown, tabIndex } = useRadioKeys(options.map((o) => o.value), value, onChange);
  const block = variant === "block";
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={block ? "grid gap-2" : "flex flex-wrap gap-2"}
      style={block ? { gridTemplateColumns: `repeat(${columns ?? options.length}, minmax(0, 1fr))` } : undefined}
    >
      {options.map((o, i) => {
        const sel = o.value === value;
        return (
          <button
            key={String(o.value)}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={sel}
            aria-label={o.ariaLabel}
            tabIndex={tabIndex(i)}
            onKeyDown={(e) => onKeyDown(e, i)}
            onClick={() => onChange(o.value)}
            className={
              block
                ? `min-h-[64px] px-1 flex flex-col items-center justify-center gap-0.5 rounded-[20px] border-[1.5px] text-body-lg ${sel ? SEL : OFF}`
                : `min-h-touch px-4 flex items-center gap-1.5 rounded-full border text-body ${sel ? `${SEL} font-extrabold` : OFF}`
            }
          >
            <span className="flex items-center gap-1.5">
              {sel && <Check size={block ? 18 : 16} strokeWidth={2.5} aria-hidden="true" />}
              {o.label}
            </span>
            {o.sub && <span className={`text-caption font-bold ${sel ? "opacity-90" : "text-muted-foreground"}`}>{o.sub}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Multi-select toggle chips with an optional "More" expander and "Add" chip. */
export function ToggleChips<T extends string>({
  options, selected, onToggle, visibleCount, onAdd, addLabel, tone = "profile",
}: {
  options: ChoiceOption<T>[];
  selected: T[];
  onToggle: (v: T) => void;
  visibleCount?: number;
  onAdd?: () => void;
  addLabel?: string;
  tone?: "profile" | "warning";
}) {
  const [expanded, setExpanded] = useState(false);
  const showAll = visibleCount === undefined || expanded || options.slice(visibleCount).some((o) => selected.includes(o.value));
  const shown = showAll ? options : options.slice(0, visibleCount);
  const selClass = tone === "warning" ? "bg-warning border-warning-border text-warning-ink font-extrabold" : `${SEL} font-extrabold`;
  return (
    <div className="flex flex-wrap gap-2">
      {shown.map((o) => {
        const sel = selected.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={sel}
            onClick={() => onToggle(o.value)}
            className={`min-h-touch-min px-4 flex items-center gap-1.5 rounded-full border text-body ${sel ? selClass : OFF}`}
          >
            {sel && <Check size={16} strokeWidth={2.5} aria-hidden="true" />}
            {o.label}
          </button>
        );
      })}
      {!showAll && (
        <MoreChip label="More" onClick={() => setExpanded(true)} />
      )}
      {onAdd && <MoreChip label={addLabel ?? "Add"} plus onClick={onAdd} />}
    </div>
  );
}

export function MoreChip({ label, onClick, plus }: { label: string; onClick: () => void; plus?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-touch-min px-4 flex items-center gap-1.5 rounded-full border-[1.5px] border-dashed border-dashed-line bg-card text-body text-foreground"
    >
      {plus && <Plus size={16} strokeWidth={2} aria-hidden="true" />}
      {label}
      {!plus && <ChevronDown size={16} strokeWidth={2} aria-hidden="true" />}
    </button>
  );
}

// ─── Option tiles (activities, stool scale, portion plates) ─────────────────

export interface TileOption<T> {
  value: T;
  label: string;
  sub?: string;
  icon: ReactNode;
  ariaLabel?: string;
}

export function OptionTiles<T extends string | number>({
  label, options, value, onChange, columns = 4, minHeight = 76, extra,
}: {
  label: string;
  options: TileOption<T>[];
  value: T | null;
  onChange: (v: T) => void;
  columns?: number;
  minHeight?: number;
  extra?: ReactNode;
}) {
  const { refs, onKeyDown, tabIndex } = useRadioKeys(options.map((o) => o.value), value, onChange);
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {options.map((o, i) => {
        const sel = o.value === value;
        return (
          <button
            key={String(o.value)}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={sel}
            aria-label={o.ariaLabel}
            tabIndex={tabIndex(i)}
            onKeyDown={(e) => onKeyDown(e, i)}
            onClick={() => onChange(o.value)}
            style={{ minHeight }}
            className={`relative flex flex-col items-center justify-center gap-1 px-0.5 py-1.5 rounded-[18px] text-foreground ${
              sel ? "border-2 border-profile bg-profile-tint" : "border-[1.5px] border-border bg-secondary"
            }`}
          >
            {sel && (
              <span aria-hidden="true" className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-profile text-on-profile flex items-center justify-center">
                <Check size={12} strokeWidth={3} />
              </span>
            )}
            {o.icon}
            <span className="text-[0.8125rem] leading-tight font-extrabold text-center">{o.label}</span>
            {o.sub && <span className={`text-micro font-bold text-center leading-tight ${sel ? "text-profile-ink" : "text-muted-foreground"}`}>{o.sub}</span>}
          </button>
        );
      })}
      {extra}
    </div>
  );
}

// ─── Face scale (mood, enjoyment) ────────────────────────────────────────────

const MOUTHS = [
  "M8 17c2.4-2.6 5.6-2.6 8 0",
  "M8.5 16.2c2.2-1.3 4.8-1.3 7 0",
  "M8.5 15.5h7",
  "M8.5 14.5c2.2 1.6 4.8 1.6 7 0",
  "M8 13.5c2.4 3.2 5.6 3.2 8 0",
];

export function Face({ level, size = 28 }: { level: number; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" />
      <circle cx="9" cy="10" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10" r="1.2" fill="currentColor" stroke="none" />
      <path d={MOUTHS[level - 1]} />
    </svg>
  );
}

export function FaceScale({
  label, labels, value, onChange,
}: {
  label: string;
  labels: readonly string[];
  value: number | null;
  onChange: (v: number) => void;
}) {
  const values = [1, 2, 3, 4, 5];
  const { refs, onKeyDown, tabIndex } = useRadioKeys(values, value, onChange);
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-5 gap-1">
      {values.map((v, i) => {
        const sel = v === value;
        return (
          <button
            key={v}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={sel}
            tabIndex={tabIndex(i)}
            onKeyDown={(e) => onKeyDown(e, i)}
            onClick={() => onChange(v)}
            className="flex flex-col items-center gap-1 py-1"
          >
            <span className={`w-[52px] h-[52px] rounded-full flex items-center justify-center ${sel ? "bg-profile text-on-profile" : "bg-secondary text-foreground border border-border"}`}>
              <Face level={v} />
            </span>
            <span className={`text-micro text-center leading-tight ${sel ? "font-extrabold text-profile-ink" : "font-bold text-muted-foreground"}`}>{labels[i]}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Segmented control ───────────────────────────────────────────────────────

export function Segmented<T extends string>({
  label, options, value, onChange,
}: {
  label: string;
  options: ChoiceOption<T>[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  const { refs, onKeyDown, tabIndex } = useRadioKeys(options.map((o) => o.value), value, onChange);
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-1 p-[3px] rounded-full border border-border bg-card" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o, i) => {
        const sel = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={sel}
            tabIndex={tabIndex(i)}
            onKeyDown={(e) => onKeyDown(e, i)}
            onClick={() => onChange(o.value)}
            className={`min-h-touch flex items-center justify-center gap-1 rounded-full text-body ${sel ? "bg-profile text-on-profile font-extrabold" : "text-foreground"}`}
          >
            {sel && <Check size={16} strokeWidth={2.5} aria-hidden="true" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Stepper ─────────────────────────────────────────────────────────────────

export function Stepper({
  display, caption, onDecrease, onIncrease, decreaseLabel = "Less", increaseLabel = "More", canDecrease = true, canIncrease = true,
}: {
  display: string;
  caption?: string;
  onDecrease: () => void;
  onIncrease: () => void;
  decreaseLabel?: string;
  increaseLabel?: string;
  canDecrease?: boolean;
  canIncrease?: boolean;
}) {
  return (
    <div className="grid grid-cols-[56px_minmax(0,1fr)_56px] items-center gap-2 p-3 rounded-card bg-secondary">
      <button type="button" aria-label={decreaseLabel} onClick={onDecrease} disabled={!canDecrease} className="w-14 h-14 rounded-full bg-card shadow-raised flex items-center justify-center disabled:opacity-40">
        <Minus size={22} strokeWidth={2} aria-hidden="true" />
      </button>
      <div className="flex flex-col items-center" aria-live="polite">
        <span className="font-display text-display-1 tabular-nums">{display}</span>
        {caption && <span className="text-caption font-bold text-muted-foreground">{caption}</span>}
      </div>
      <button type="button" aria-label={increaseLabel} onClick={onIncrease} disabled={!canIncrease} className="w-14 h-14 rounded-full bg-card shadow-raised flex items-center justify-center disabled:opacity-40">
        <Plus size={22} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );
}

// ─── Inline notice ───────────────────────────────────────────────────────────

const TONES = {
  warning: { box: "bg-warning border-warning-border text-warning-ink", icon: Info },
  info:    { box: "bg-info border-info-border text-info-ink",          icon: Info },
  urgent:  { box: "bg-flag border-flag-border text-flag-ink",          icon: AlertTriangle },
};

export function Notice({
  tone, title, children, action, role = "note",
}: {
  tone: keyof typeof TONES;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  role?: "note" | "alert";
}) {
  const { box, icon: Icon } = TONES[tone];
  return (
    <div role={role} className={`flex flex-col gap-2.5 p-3.5 rounded-[18px] border ${box}`}>
      <div className="flex items-start gap-2.5">
        <Icon size={22} strokeWidth={2} className="flex-none mt-0.5" aria-hidden="true" />
        <div className="flex flex-col gap-1">
          {title && <span className="text-body font-extrabold">{title}</span>}
          {children && <span className="text-label font-normal leading-snug">{children}</span>}
        </div>
      </div>
      {action}
    </div>
  );
}
