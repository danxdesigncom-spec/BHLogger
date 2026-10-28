"use client";

import { useTranslations } from "next-intl";
import { Timer } from "lucide-react";

/** QL-11: start a timer from a sheet instead of picking a duration; Home shows it until Stop. */
export function TimerStart({ running, onStart }: { running: boolean; onStart: () => void }) {
  const t = useTranslations("timer");
  if (running) return <p className="text-caption font-bold text-muted-foreground">{t("alreadyRunning")}</p>;
  return (
    <button
      type="button"
      onClick={onStart}
      className="self-start min-h-touch-min inline-flex items-center gap-1.5 px-4 rounded-full border-[1.5px] border-border-strong bg-card text-label font-extrabold"
    >
      <Timer size={16} strokeWidth={2} aria-hidden="true" />
      {t("start")}
    </button>
  );
}
