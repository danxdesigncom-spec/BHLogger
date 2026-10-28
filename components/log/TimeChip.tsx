"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Clock } from "lucide-react";
import { formatWeekdayTime } from "@/lib/prefs";

type Preset = "now" | "15m" | "30m" | "1h" | "2h" | "custom";

const PRESETS: { value: Exclude<Preset, "custom">; label: string; offsetMs: number }[] = [
  { value: "now", label: "Now",        offsetMs: 0 },
  { value: "15m", label: "15 min ago", offsetMs: 15 * 60_000 },
  { value: "30m", label: "30 min ago", offsetMs: 30 * 60_000 },
  { value: "1h",  label: "1 h ago",    offsetMs: 60 * 60_000 },
  { value: "2h",  label: "2 h ago",    offsetMs: 120 * 60_000 },
];

interface Props {
  value: Date;
  onChange: (date: Date) => void;
}

function toLocalDatetimeValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TimeChip({ value, onChange }: Props) {
  const [preset, setPreset] = useState<Preset>("now");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const label =
    preset === "custom"
      ? formatWeekdayTime(value)
      : PRESETS.find((p) => p.value === preset)!.label;

  const pick = (p: Exclude<Preset, "custom">) => {
    setPreset(p);
    onChange(new Date(Date.now() - PRESETS.find((x) => x.value === p)!.offsetMs));
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative flex-none">
      <button
        type="button"
        aria-label={`Time: ${label.toLowerCase()}. Change time`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="h-button flex items-center gap-1.5 px-4 rounded-full border border-border-strong bg-card text-body font-extrabold"
      >
        <Clock size={18} strokeWidth={2} aria-hidden="true" />
        <span className="whitespace-nowrap">{label}</span>
        <ChevronDown size={16} strokeWidth={2} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Change time"
          className="absolute bottom-full left-0 mb-2 w-60 p-1.5 rounded-xl bg-card shadow-dialog z-10"
        >
          {PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              role="menuitemradio"
              aria-checked={preset === p.value}
              onClick={() => pick(p.value)}
              className="w-full min-h-touch-min flex items-center justify-between px-3 rounded-lg text-body hover:bg-secondary"
            >
              {p.label}
              {preset === p.value && <Check size={16} strokeWidth={2.5} className="text-profile" aria-hidden="true" />}
            </button>
          ))}
          <label className="block px-3 pt-2 pb-1 text-label font-sans text-muted-foreground">
            Custom
            <input
              type="datetime-local"
              max={toLocalDatetimeValue(new Date())}
              defaultValue={toLocalDatetimeValue(value)}
              onChange={(e) => {
                const d = new Date(e.target.value);
                if (!isNaN(d.getTime()) && d <= new Date()) {
                  setPreset("custom");
                  onChange(d);
                }
              }}
              className="mt-1 w-full min-h-touch-min rounded-lg border border-border bg-card px-3 text-[16px] font-bold text-foreground"
            />
          </label>
        </div>
      )}
    </div>
  );
}
