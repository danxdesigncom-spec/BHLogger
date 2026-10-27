"use client";

import { useState } from "react";

type Preset = "now" | "15m" | "30m" | "1h" | "2h" | "custom";

const PRESETS: { value: Preset; label: string; offsetMs: number }[] = [
  { value: "now",    label: "Now",      offsetMs: 0 },
  { value: "15m",    label: "15 min ago", offsetMs: 15 * 60_000 },
  { value: "30m",    label: "30 min ago", offsetMs: 30 * 60_000 },
  { value: "1h",     label: "1 h ago",   offsetMs: 60 * 60_000 },
  { value: "2h",     label: "2 h ago",   offsetMs: 120 * 60_000 },
  { value: "custom", label: "Custom",    offsetMs: 0 },
];

interface Props {
  value: Date;
  onChange: (date: Date) => void;
}

function toLocalDatetimeValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

export function TimeChip({ value, onChange }: Props) {
  const [preset, setPreset] = useState<Preset>("now");

  const selectPreset = (p: Preset) => {
    setPreset(p);
    if (p !== "custom") {
      const off = PRESETS.find((x) => x.value === p)!.offsetMs;
      onChange(new Date(Date.now() - off));
    }
  };

  const maxDatetime = toLocalDatetimeValue(new Date());

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1.5 flex-wrap">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => selectPreset(p.value)}
            className={[
              "px-3 min-h-[36px] rounded-full text-[13px] font-bold border transition-colors",
              preset === p.value
                ? "bg-[var(--color-profile)] text-white border-[var(--color-profile)]"
                : "bg-white text-foreground border-[var(--color-border)]",
            ].join(" ")}
          >
            {p.label}
          </button>
        ))}
      </div>
      {preset === "custom" && (
        <input
          type="datetime-local"
          max={maxDatetime}
          defaultValue={toLocalDatetimeValue(value)}
          onChange={(e) => {
            const d = new Date(e.target.value);
            if (!isNaN(d.getTime()) && d <= new Date()) onChange(d);
          }}
          className="w-full min-h-[44px] rounded-2xl border-[1.5px] border-[var(--color-border)] bg-white px-4 text-[15px] font-bold"
        />
      )}
    </div>
  );
}
