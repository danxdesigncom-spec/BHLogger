"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

/**
 * DESIGN 4.18 pattern: centered alert dialog; the safe choice is the focused default.
 * `acknowledge` adds a checkbox that must be ticked before the confirm button works (SET-07).
 */
export function ConfirmDialog({
  title, body, confirmLabel, cancelLabel, destructive, acknowledge, onConfirm, onCancel,
}: {
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  acknowledge?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("common");
  const [acknowledged, setAcknowledged] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-6 bg-[var(--overlay-strong)] animate-fade-in">
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" className="w-full max-w-sm rounded-tile bg-card p-6 shadow-dialog space-y-3 text-center">
        <h2 id="confirm-title" className="font-display text-title-2">{title}</h2>
        {body && <p className="text-body text-foreground-2">{body}</p>}
        {acknowledge && (
          <label className="min-h-touch flex items-center gap-3 px-1 text-left text-body font-bold cursor-pointer">
            <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} className="w-6 h-6 flex-none accent-[var(--destructive)]" />
            {acknowledge}
          </label>
        )}
        <button type="button" autoFocus onClick={onCancel} className="w-full h-button rounded-full bg-primary text-primary-foreground text-body-lg">
          {cancelLabel ?? t("cancel")}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!!acknowledge && !acknowledged}
          className={`w-full h-button rounded-full border-[1.5px] border-border-strong bg-card text-body-lg disabled:opacity-40 ${destructive ? "text-destructive" : ""}`}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
