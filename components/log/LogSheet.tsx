"use client";

import { useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { X, Flag, ChevronDown, Loader2 } from "lucide-react";
import { TimeChip } from "./TimeChip";
import type { ToastEntry } from "./UndoToast";
import { useRepo } from "@/lib/data/repo-context";
import { recordLoggingSession } from "@/lib/install";
import { useHousehold } from "@/lib/context/household-provider";
import { useQueryClient } from "@tanstack/react-query";
import { formatTime } from "@/lib/prefs";

export type ModuleType = "bathroom" | "eating" | "activity" | "mood" | "medication";

export interface LogSheetProps {
  module: ModuleType;
  moduleLabel: string;
  open: boolean;
  onClose: () => void;
  onSaved: (toast: ToastEntry) => void;
  /** Muted summary under "Add details", e.g. "Size, rash, blowout, note" */
  detailsHint?: string;
  /** Sheet title when it isn't the module name (S07 uses the medication name). */
  title?: string;
  /** Appended to "for Leo", e.g. "as needed". */
  subtitle?: string;
  saveLabel?: string;
  /** Runs before saving; return the data to save, or null to cancel (MED-07 duplicate-dose check). */
  confirmSave?: (draft: { data: Record<string, unknown>; occurredAt: Date }) => Promise<Record<string, unknown> | null>;
  children?: (ctx: ModuleFormContext) => ReactNode;
}

export interface ModuleFormContext {
  /** ready=false keeps Save disabled until the required choice is made */
  setData: (data: Record<string, unknown>, summary: string, ready?: boolean) => void;
  setFlagged: (flagged: boolean) => void;
  flagged: boolean;
  /** Portal target inside "Add details" for the module's optional chips. */
  detailsEl: HTMLElement | null;
}

export const MODULE_ICONS: Record<ModuleType, ReactNode> = {
  bathroom:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6" aria-hidden="true"><path d="M12 3.5c3 3.6 5.5 6.6 5.5 10a5.5 5.5 0 0 1-11 0c0-3.4 2.5-6.4 5.5-10z"/></svg>,
  eating:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6" aria-hidden="true"><path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10"/><path d="M17 21V3c-2 1-3 3.5-3 6.5V13h3"/></svg>,
  activity:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"/></svg>,
  mood:       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5c2.2 1.6 4.8 1.6 7 0"/><circle cx="9" cy="10" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r="1.2" fill="currentColor" stroke="none"/></svg>,
  medication: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6" aria-hidden="true"><path d="M10.5 20.5l10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7z"/><path d="M8.5 8.5l7 7"/></svg>,
};

export const MODULE_CIRCLE: Record<ModuleType, string> = {
  bathroom:   "bg-bathroom text-bathroom-ink",
  eating:     "bg-eating text-eating-ink",
  activity:   "bg-activity text-activity-ink",
  mood:       "bg-mood text-mood-ink",
  medication: "bg-medication text-medication-ink",
};

export function LogSheet({ module, moduleLabel, open, onClose, onSaved, detailsHint, title, subtitle, saveLabel, confirmSave, children }: LogSheetProps) {
  const { householdId, activeProfileId, profiles } = useHousehold();
  const qc = useQueryClient();
  const repo = useRepo();
  const titleRef = useRef<HTMLHeadingElement>(null);

  const activeProfile = profiles.find((p) => p.id === activeProfileId);

  const [time, setTime] = useState(() => new Date());
  const [note, setNote] = useState("");
  const [flagged, setFlagged] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [moduleData, setModuleData] = useState<Record<string, unknown>>({});
  const [moduleSummary, setModuleSummary] = useState("");
  const [ready, setReady] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailsEl, setDetailsEl] = useState<HTMLDivElement | null>(null);

  const handleSetData = useCallback((data: Record<string, unknown>, summary: string, isReady = true) => {
    setModuleData(data);
    setModuleSummary(summary);
    setReady(isReady);
    if (isReady) setShowHint(false);
  }, []);

  const reset = useCallback(() => {
    setTime(new Date());
    setNote("");
    setFlagged(false);
    setDetailsOpen(false);
    setModuleData({});
    setModuleSummary("");
    setReady(false);
    setConfirmDiscard(false);
    setShowHint(false);
    setError(null);
  }, []);

  const dirty = Object.keys(moduleData).length > 0 || note.trim() !== "";

  const requestClose = useCallback(() => {
    if (dirty && !confirmDiscard) {
      setConfirmDiscard(true);
      return;
    }
    reset();
    onClose();
  }, [dirty, confirmDiscard, reset, onClose]);

  useEffect(() => {
    if (!open) return;
    titleRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, requestClose]);

  const handleSave = async () => {
    if (!ready) {
      setShowHint(true);
      return;
    }
    if (!activeProfileId || !activeProfile) return;
    setPending(true);
    setError(null);

    let data = moduleData;
    if (confirmSave) {
      const confirmed = await confirmSave({ data: moduleData, occurredAt: time });
      if (!confirmed) {
        setPending(false);
        return;
      }
      data = confirmed;
    }

    const entryId = crypto.randomUUID();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const result = await repo.saveEntry({
      id: entryId,
      householdId,
      profileId: activeProfileId,
      type: module,
      occurredAt: time.toISOString(),
      tz,
      data,
      note: note.trim() || undefined,
      flaggedForDoctor: flagged,
    });

    setPending(false);

    if ("error" in result) {
      setError(result.error ?? "Couldn't save. Try again.");
      return;
    }

    try { navigator.vibrate?.(10); } catch { /* unsupported */ }
    recordLoggingSession();
    for (const key of ["latest-entry", "entries", "pending"]) qc.invalidateQueries({ queryKey: [key] });

    onSaved({
      entryId,
      householdId,
      profileName: activeProfile.name,
      summary: moduleSummary || moduleLabel,
      time: formatTime(time),
    });

    reset();
    onClose();
  };

  if (!open) return null;

  return (
    <>
      <div aria-hidden="true" className="fixed inset-0 bg-[var(--overlay)] z-40 animate-fade-in" onClick={requestClose} />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        className="fixed left-0 right-0 bottom-0 z-50 flex flex-col rounded-t-sheet bg-card max-h-[calc(100dvh-56px)] animate-sheet-in md:left-1/2 md:right-auto md:bottom-auto md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[480px] md:rounded-sheet"
      >
        <div aria-hidden="true" className="w-10 h-[5px] mt-2.5 flex-none self-center rounded-full bg-grabber" />

        <header className="flex-none flex items-center gap-3 px-5 pt-3 pb-1">
          <span className={`w-12 h-12 flex-none rounded-full flex items-center justify-center ${MODULE_CIRCLE[module]}`}>
            {MODULE_ICONS[module]}
          </span>
          <div className="flex-1 min-w-0">
            <h2 id="sheet-title" ref={titleRef} tabIndex={-1} className="font-display text-title-1 outline-none">
              {title ?? moduleLabel}
            </h2>
            <p className="flex items-center gap-1.5 text-label font-bold text-muted-foreground">
              <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full bg-profile" />
              for {activeProfile?.name ?? ""}{subtitle ? ` · ${subtitle}` : ""}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={requestClose}
            className="w-11 h-11 flex-none rounded-full bg-secondary flex items-center justify-center"
          >
            <X size={20} strokeWidth={2} aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 pt-3 pb-4 space-y-4">
          {children?.({ setData: handleSetData, setFlagged, flagged, detailsEl })}

          <div className="rounded-lg bg-secondary">
            <button
              type="button"
              aria-expanded={detailsOpen}
              onClick={() => setDetailsOpen((v) => !v)}
              className="w-full min-h-button flex items-center gap-2.5 px-4 text-left"
            >
              <span className="flex-1 flex flex-col">
                <span className="text-body font-extrabold">Add details</span>
                {!detailsOpen && (
                  <span className="text-caption text-muted-foreground">
                    {flagged ? "Flagged for doctor" : detailsHint ?? "Note, flag for doctor"}
                  </span>
                )}
              </span>
              <ChevronDown size={20} strokeWidth={2} aria-hidden="true" className={`transition-transform ${detailsOpen ? "rotate-180" : ""}`} />
            </button>
            <div hidden={!detailsOpen} className="px-4 pb-4 space-y-3">
              <div ref={setDetailsEl} className="space-y-3 empty:hidden" />
                <label className="block">
                  <span className="sr-only">Note</span>
                  <textarea
                    placeholder="Note (optional)"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-border bg-card px-4 py-3 text-[16px] font-bold resize-none focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  />
                </label>
                <label className="flex items-center justify-between gap-3 min-h-touch-min">
                  <span className="flex flex-col">
                    <span className="flex items-center gap-1.5 text-body font-extrabold">
                      <Flag size={16} strokeWidth={2} aria-hidden="true" />
                      Flag for doctor
                    </span>
                    <span className="text-caption text-muted-foreground">Shows up in the next doctor report</span>
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={flagged}
                    onChange={(e) => setFlagged(e.target.checked)}
                    className="switch"
                  />
                </label>
            </div>
          </div>
        </div>

        {(showHint || error) && (
          <p role="alert" className="flex-none px-5 pb-1 text-caption font-bold text-destructive">
            {error ?? "Pick what happened"}
          </p>
        )}

        <footer
          className="flex-none flex items-center gap-2.5 px-5 pt-3 border-t border-divider"
          style={{ paddingBottom: "calc(28px + env(safe-area-inset-bottom, 0px))" }}
        >
          <TimeChip value={time} onChange={setTime} />
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            aria-disabled={!ready || pending}
            className={`flex-1 h-button flex items-center justify-center rounded-full bg-primary text-primary-foreground text-body-lg ${!ready ? "opacity-40" : ""} disabled:opacity-60`}
          >
            {pending ? <Loader2 size={20} strokeWidth={2} className="animate-spin" aria-label="Saving" /> : saveLabel ?? "Save"}
          </button>
        </footer>

        {confirmDiscard && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-t-sheet bg-[var(--overlay)] px-6">
            <div role="alertdialog" aria-modal="true" aria-labelledby="discard-title" className="w-full max-w-sm rounded-tile bg-card p-6 shadow-dialog space-y-3">
              <h3 id="discard-title" className="font-display text-title-2 text-center">Discard this entry?</h3>
              <p className="text-body text-foreground-2 text-center">Nothing has been saved yet.</p>
              <button
                type="button"
                autoFocus
                onClick={() => setConfirmDiscard(false)}
                className="w-full h-button rounded-full bg-primary text-primary-foreground text-body-lg"
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={() => { reset(); onClose(); }}
                className="w-full h-button rounded-full border-[1.5px] border-border-strong bg-card text-body-lg text-destructive"
              >
                Discard
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
