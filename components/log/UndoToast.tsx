"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";

export interface ToastEntry {
  entryId: string;
  householdId: string;
  profileName: string;
  summary: string;
  time: string;
  /** Overrides "{summary} logged for {profileName}", e.g. for deletions. */
  message?: string;
}

interface Props {
  toast: ToastEntry | null;
  onUndo: (entryId: string, householdId: string) => void;
  onDismiss: () => void;
}

export const TOAST_DURATION_MS = 6000;

export function UndoToast({ toast, onUndo, onDismiss }: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [paused, setPaused] = useState(false);
  const t = useTranslations();

  useEffect(() => {
    if (!toast || paused) return;
    timerRef.current = setTimeout(onDismiss, TOAST_DURATION_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast, paused, onDismiss]);

  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="fixed left-4 right-4 z-50 flex items-center gap-3 py-2 pr-2 pl-4 rounded-xl bg-toast text-toast-foreground shadow-toast animate-toast-in md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[420px]"
      style={{ bottom: "calc(100px + env(safe-area-inset-bottom, 0px))" }}
    >
      <span className="w-7 h-7 flex-none rounded-full bg-profile text-on-profile flex items-center justify-center">
        <Check size={16} strokeWidth={2.5} aria-hidden="true" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-label font-extrabold truncate">
          {toast.message ?? t("toast.logged", { summary: toast.summary, name: toast.profileName })}
        </p>
        <p className="text-caption text-toast-muted">{toast.time}</p>
      </div>
      <button
        type="button"
        onClick={() => onUndo(toast.entryId, toast.householdId)}
        className="flex-none h-11 px-4 rounded-[14px] bg-toast-action text-body font-extrabold"
      >
        {t("common.undo")}
      </button>
    </div>
  );
}
