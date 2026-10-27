"use client";

import { type ReactNode } from "react";
import type { ModuleType } from "./LogSheet";

interface Props {
  module: ModuleType;
  label: string;
  icon: ReactNode;
  status: string | null;
  alertPill?: string | null;
  fullWidth?: boolean;
  onClick: () => void;
}

const BG: Record<ModuleType, string> = {
  bathroom:   "bg-[var(--module-bathroom)]",
  eating:     "bg-[var(--module-eating)]",
  activity:   "bg-[var(--module-activity)]",
  mood:       "bg-[var(--module-mood)]",
  medication: "bg-[var(--module-medication)]",
};

const ICON_BG: Record<ModuleType, string> = {
  bathroom:   "bg-white/70 text-[var(--module-bathroom-ink)]",
  eating:     "bg-white/70 text-[var(--module-eating-ink)]",
  activity:   "bg-white/70 text-[var(--module-activity-ink)]",
  mood:       "bg-white/70 text-[var(--module-mood-ink)]",
  medication: "bg-white/70 text-[var(--module-medication-ink)]",
};

const ALERT_PILL: Record<ModuleType, string> = {
  bathroom:   "bg-[var(--module-bathroom-ink)] text-white",
  eating:     "bg-[var(--module-eating-ink)] text-white",
  activity:   "bg-[var(--module-activity-ink)] text-white",
  mood:       "bg-[var(--module-mood-ink)] text-white",
  medication: "bg-[var(--module-medication-ink)] text-white",
};

const INK: Record<ModuleType, string> = {
  bathroom:   "text-[var(--module-bathroom-ink)]",
  eating:     "text-[var(--module-eating-ink)]",
  activity:   "text-[var(--module-activity-ink)]",
  mood:       "text-[var(--module-mood-ink)]",
  medication: "text-[var(--module-medication-ink)]",
};

export function ModuleTile({ module, label, icon, status, alertPill, fullWidth, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex flex-col justify-between p-4 rounded-[20px] min-h-[96px] text-left transition-opacity active:opacity-75",
        BG[module],
        fullWidth ? "col-span-2" : "",
      ].join(" ")}
    >
      {/* Top row: icon */}
      <span className={`w-10 h-10 rounded-full flex items-center justify-center ${ICON_BG[module]}`}>
        {icon}
      </span>

      {/* Bottom row: label + status */}
      <div className="mt-2">
        <p className={`text-[17px] font-extrabold leading-tight ${INK[module]}`}>{label}</p>
        {alertPill ? (
          <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[12px] font-extrabold ${ALERT_PILL[module]}`}>
            {alertPill}
          </span>
        ) : status ? (
          <p className={`text-[13px] font-bold mt-0.5 opacity-80 ${INK[module]}`}>{status}</p>
        ) : null}
      </div>
    </button>
  );
}
