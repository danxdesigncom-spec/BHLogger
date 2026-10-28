"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import type { ModuleFormContext } from "../LogSheet";

type ActivityKey =
  | "playground" | "music" | "books" | "screen_time"
  | "sensory_play" | "swimming" | "building_toys" | "therapy";

type Enjoyment = 1 | 2 | 3 | 4 | 5;

type Duration = 5 | 15 | 30 | 60 | 90;

const ACTIVITIES: { key: ActivityKey; label: string; svg: string }[] = [
  {
    key: "playground", label: "Playground",
    svg: '<path d="M5 21V5h14v16"/><path d="M9 5v9M15 5v9"/><path d="M8 14h8"/>',
  },
  {
    key: "music", label: "Music",
    svg: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  },
  {
    key: "books", label: "Books",
    svg: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/><path d="M19 19v2H6"/>',
  },
  {
    key: "screen_time", label: "Screen time",
    svg: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  },
  {
    key: "sensory_play", label: "Sensory play",
    svg: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12"/><path d="M11 11V4.5a1.5 1.5 0 0 1 3 0V12"/><path d="M14 11.5V6a1.5 1.5 0 0 1 3 0v8a7 7 0 0 1-7 7h-.5A6.5 6.5 0 0 1 5 17.5L3.5 14a1.5 1.5 0 0 1 2.6-1.4L8 15"/>',
  },
  {
    key: "swimming", label: "Swimming",
    svg: '<path d="M3 15c1.5 1.3 3 1.3 4.5 0s3-1.3 4.5 0 3 1.3 4.5 0 3-1.3 4.5 0"/><path d="M3 19c1.5 1.3 3 1.3 4.5 0s3-1.3 4.5 0 3 1.3 4.5 0 3-1.3 4.5 0"/><circle cx="15" cy="6.5" r="2"/><path d="M6 11.5l4-4 3 3"/>',
  },
  {
    key: "building_toys", label: "Building toys",
    svg: '<rect x="3.5" y="12" width="8" height="8" rx="1.5"/><rect x="12.5" y="12" width="8" height="8" rx="1.5"/><rect x="8" y="3.5" width="8" height="8" rx="1.5"/>',
  },
  {
    key: "therapy", label: "Therapy",
    svg: '<path d="M4 5h16v11H9l-5 4z"/><path d="M12 13.2s-3-1.8-3-4a1.7 1.7 0 0 1 3-1 1.7 1.7 0 0 1 3 1c0 2.2-3 4-3 4z"/>',
  },
];

const ENJOYMENT: { val: Enjoyment; label: string; mouthSvg: string }[] = [
  { val: 1, label: "Disliked",     mouthSvg: '<path d="M8 17c2.4-2.6 5.6-2.6 8 0"/>' },
  { val: 2, label: "Not into it",  mouthSvg: '<path d="M8.5 16.2c2.2-1.3 4.8-1.3 7 0"/>' },
  { val: 3, label: "Okay",         mouthSvg: '<path d="M8.5 15.5h7"/>' },
  { val: 4, label: "Enjoyed",      mouthSvg: '<path d="M8.5 14.5c2.2 1.6 4.8 1.6 7 0"/>' },
  { val: 5, label: "Loved it",     mouthSvg: '<path d="M8 13.5c2.4 3.2 5.6 3.2 8 0"/>' },
];

const DURATIONS: { val: Duration; label: string }[] = [
  { val: 5,  label: "5 min" },
  { val: 15, label: "15 min" },
  { val: 30, label: "30 min" },
  { val: 60, label: "1 hour" },
  { val: 90, label: "90+ min" },
];

const TILE_SEL = "relative bg-[var(--color-profile-bg)] border-2 border-[var(--color-profile)] text-foreground";
const TILE_OFF = "bg-[var(--color-surface-2)] border-[1.5px] border-[var(--color-border)] text-foreground";
const PILL_SEL = "bg-[var(--color-profile)] border-[var(--color-profile)] text-white";
const PILL_OFF = "bg-[var(--color-surface-2)] border-[var(--color-border)] text-foreground";

interface Props { ctx: ModuleFormContext }

export function ActivitySheet({ ctx }: Props) {
  const [activity, setActivity] = useState<ActivityKey | null>(null);
  const [enjoyment, setEnjoyment] = useState<Enjoyment | null>(null);
  const [duration, setDuration] = useState<Duration | null>(null);

  const push = (overrides: Record<string, unknown> = {}) => {
    const a = (overrides.activity as ActivityKey | null) !== undefined ? (overrides.activity as ActivityKey | null) : activity;
    const e = (overrides.enjoyment as Enjoyment | null) !== undefined ? (overrides.enjoyment as Enjoyment | null) : enjoyment;
    const d = (overrides.duration as Duration | null) !== undefined ? (overrides.duration as Duration | null) : duration;
    const data: Record<string, unknown> = {};
    if (a) data.activity = a;
    if (e) data.enjoyment = e;
    if (d) data.durationMin = d;
    const label = a ? ACTIVITIES.find((x) => x.key === a)?.label ?? "Activity" : "Activity";
    ctx.setData(data, label);
  };

  return (
    <div className="space-y-4">
      {/* Activity grid */}
      <div>
        <h2 className="text-[14px] font-extrabold text-muted-foreground mb-2">What did you do?</h2>
        <div className="grid grid-cols-3 gap-2">
          {ACTIVITIES.map(({ key, label, svg }) => {
            const sel = activity === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={sel}
                onClick={() => { setActivity(key); push({ activity: key }); }}
                className={`min-h-[76px] flex flex-col items-center justify-center gap-1.5 rounded-[18px] cursor-pointer transition-colors ${sel ? TILE_SEL : TILE_OFF}`}
              >
                {sel && (
                  <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[var(--color-profile)] text-white flex items-center justify-center flex-none">
                    <Check size={11} strokeWidth={3} />
                  </span>
                )}
                <svg
                  viewBox="0 0 24 24"
                  width={24}
                  height={24}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  dangerouslySetInnerHTML={{ __html: svg }}
                />
                <span className="text-[13px] font-extrabold text-center leading-tight px-1">{label}</span>
              </button>
            );
          })}
          {/* New activity tile */}
          <button
            type="button"
            className="min-h-[76px] flex flex-col items-center justify-center gap-1.5 rounded-[18px] border-[1.5px] border-dashed border-[var(--color-border)] text-muted-foreground cursor-pointer"
          >
            <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            <span className="text-[13px] font-bold">New</span>
          </button>
        </div>
      </div>

      {/* Enjoyment faces */}
      <div>
        <h2 className="text-[14px] font-extrabold text-muted-foreground mb-2">How did it go?</h2>
        <div className="flex justify-between gap-1">
          {ENJOYMENT.map(({ val, label, mouthSvg }) => {
            const sel = enjoyment === val;
            return (
              <button
                key={val}
                type="button"
                aria-label={label}
                aria-pressed={sel}
                onClick={() => { setEnjoyment(val); push({ enjoyment: val }); }}
                className="flex flex-col items-center gap-1 cursor-pointer"
              >
                <span
                  className={`w-[52px] h-[52px] rounded-full flex items-center justify-center transition-all ${
                    sel
                      ? "bg-[var(--color-profile)] ring-2 ring-offset-2 ring-[var(--color-profile)]"
                      : "bg-[var(--color-surface-2)]"
                  }`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width={28}
                    height={28}
                    fill="none"
                    stroke={sel ? "white" : "currentColor"}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10"/>
                    <circle cx="9" cy="10" r="1.2" fill={sel ? "white" : "currentColor"} stroke="none"/>
                    <circle cx="15" cy="10" r="1.2" fill={sel ? "white" : "currentColor"} stroke="none"/>
                    <g dangerouslySetInnerHTML={{ __html: mouthSvg }} />
                  </svg>
                </span>
                <span className={`text-[11px] font-bold text-center leading-tight ${sel ? "text-[var(--color-profile)]" : "text-muted-foreground"}`}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Duration */}
      <div>
        <h2 className="text-[14px] font-extrabold text-muted-foreground mb-2">How long?</h2>
        <div className="flex flex-wrap gap-2">
          {DURATIONS.map(({ val, label }) => {
            const sel = duration === val;
            return (
              <button
                key={val}
                type="button"
                aria-pressed={sel}
                onClick={() => { setDuration(val); push({ duration: val }); }}
                className={`min-h-[44px] px-4 flex items-center gap-1.5 rounded-full border font-bold text-[15px] cursor-pointer transition-colors ${sel ? PILL_SEL : PILL_OFF}`}
              >
                {sel && <Check size={14} strokeWidth={3} />}
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
