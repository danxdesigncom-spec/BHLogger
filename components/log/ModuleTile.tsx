"use client";

import { type ReactNode } from "react";
import type { ModuleType } from "./LogSheet";

interface Props {
  module: ModuleType;
  label: string;
  icon: ReactNode;
  status: string | null;
  alertPill?: string | null;
  onClick: () => void;
}

const BG: Record<ModuleType, string> = {
  bathroom:   "bg-bathroom",
  eating:     "bg-eating",
  activity:   "bg-activity",
  mood:       "bg-mood",
  medication: "bg-medication",
};

const INK: Record<ModuleType, string> = {
  bathroom:   "text-bathroom-ink",
  eating:     "text-eating-ink",
  activity:   "text-activity-ink",
  mood:       "text-mood-ink",
  medication: "text-medication-ink",
};

export function ModuleTile({ module, label, icon, status, alertPill, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start justify-between gap-3 min-h-[124px] p-4 rounded-tile text-left text-foreground transition-opacity active:opacity-75 ${BG[module]}`}
    >
      <span className={`w-11 h-11 rounded-full bg-card flex items-center justify-center ${INK[module]}`}>
        {icon}
      </span>
      <span className="flex flex-col items-start gap-1">
        <span className="font-display text-title-3">{label}</span>{" "}
        {alertPill ? (
          <span className="px-2.5 py-0.5 rounded-full bg-card text-caption font-extrabold text-warning-ink">{alertPill}</span>
        ) : status ? (
          <span className="text-label font-bold text-foreground-2">{status}</span>
        ) : null}
      </span>
    </button>
  );
}
