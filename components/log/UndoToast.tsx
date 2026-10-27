"use client";

import { useEffect, useRef } from "react";
import { Check } from "lucide-react";

export interface ToastEntry {
  entryId: string;
  householdId: string;
  profileName: string;
  summary: string;
  time: string;
}

interface Props {
  toast: ToastEntry | null;
  onUndo: (entryId: string, householdId: string) => void;
  onDismiss: () => void;
}

const TOAST_DURATION_MS = 6000;

export function UndoToast({ toast, onUndo, onDismiss }: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!toast) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(onDismiss, TOAST_DURATION_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="fixed left-4 right-4 z-50 flex items-center gap-3 px-4 py-3.5 rounded-[20px] bg-foreground text-background shadow-lg"
      style={{ bottom: "calc(72px + max(12px, env(safe-area-inset-bottom, 0px)))" }}
    >
      <span className="w-8 h-8 flex-none rounded-full bg-[var(--color-profile)] flex items-center justify-center">
        <Check size={16} strokeWidth={2.5} className="text-white" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-extrabold leading-snug truncate">
          {toast.summary} for {toast.profileName}
        </p>
        <p className="text-[13px] opacity-70">{toast.time}</p>
      </div>
      <button
        type="button"
        onClick={() => onUndo(toast.entryId, toast.householdId)}
        className="flex-none px-3 py-1.5 rounded-full bg-white/20 text-[15px] font-extrabold min-h-[36px]"
      >
        Undo
      </button>
    </div>
  );
}
