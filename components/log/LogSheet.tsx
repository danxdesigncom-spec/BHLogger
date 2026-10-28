"use client";

import { useState, useCallback, type ReactNode } from "react";
import { X, Flag, ChevronDown, Loader2 } from "lucide-react";
import { TimeChip } from "./TimeChip";
import type { ToastEntry } from "./UndoToast";
import { saveEntry } from "@/lib/actions/entries";
import { useHousehold } from "@/lib/context/household-provider";
import { useQueryClient } from "@tanstack/react-query";

export type ModuleType = "bathroom" | "eating" | "activity" | "mood" | "medication";

export interface LogSheetProps {
  module: ModuleType;
  moduleLabel: string;
  open: boolean;
  onClose: () => void;
  onSaved: (toast: ToastEntry) => void;
  /** Module-specific form content; receives a callback to provide entry data */
  children?: (ctx: ModuleFormContext) => ReactNode;
}

export interface ModuleFormContext {
  /** Module content should call this with data when ready to let Save proceed */
  setData: (data: Record<string, unknown>, summary: string) => void;
  /** Module content may call this to pre-flag the entry (e.g. calm-notice "Flag for doctor") */
  setFlagged: (flagged: boolean) => void;
}

const MODULE_ICONS: Record<ModuleType, ReactNode> = {
  bathroom:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M12 2a5 5 0 0 1 5 5v1H7V7a5 5 0 0 1 5-5Z"/><path d="M6 8h12l-1.5 11H7.5L6 8Z"/></svg>,
  eating:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6h3v2a3 3 0 0 1-3 3h-1"/></svg>,
  activity:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  mood:       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>,
  medication: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>,
};

const MODULE_COLORS: Record<ModuleType, string> = {
  bathroom:   "bg-[var(--module-bathroom)] text-[var(--module-bathroom-ink)]",
  eating:     "bg-[var(--module-eating)] text-[var(--module-eating-ink)]",
  activity:   "bg-[var(--module-activity)] text-[var(--module-activity-ink)]",
  mood:       "bg-[var(--module-mood)] text-[var(--module-mood-ink)]",
  medication: "bg-[var(--module-medication)] text-[var(--module-medication-ink)]",
};

export function LogSheet({ module, moduleLabel, open, onClose, onSaved, children }: LogSheetProps) {
  const { householdId, activeProfileId, profiles } = useHousehold();
  const qc = useQueryClient();

  const activeProfile = profiles.find((p) => p.id === activeProfileId);

  const [time, setTime] = useState(() => new Date());
  const [note, setNote] = useState("");
  const [flagged, setFlagged] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [moduleData, setModuleData] = useState<Record<string, unknown>>({});
  const [moduleSummary, setModuleSummary] = useState("");

  const handleSetData = useCallback((data: Record<string, unknown>, summary: string) => {
    setModuleData(data);
    setModuleSummary(summary);
  }, []);

  const handleSave = async () => {
    if (!activeProfileId || !activeProfile) return;
    setPending(true);

    const entryId = crypto.randomUUID();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const result = await saveEntry({
      id: entryId,
      householdId,
      profileId: activeProfileId,
      type: module,
      occurredAt: time.toISOString(),
      tz,
      data: moduleData,
      note: note.trim() || undefined,
      flaggedForDoctor: flagged,
    });

    setPending(false);

    if ("error" in result) {
      // surface error inline — M5 adds better error states
      alert(result.error);
      return;
    }

    // Vibrate on save (QL-04)
    try { navigator.vibrate?.(50); } catch { /* ignore */ }

    // Invalidate tile queries for this profile
    qc.invalidateQueries({ queryKey: ["latest-entry", activeProfileId] });

    const summary = moduleSummary || moduleLabel;
    const timeStr = time.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

    onSaved({
      entryId,
      householdId,
      profileName: activeProfile.name,
      summary,
      time: timeStr,
    });

    // Reset sheet state
    setTime(new Date());
    setNote("");
    setFlagged(false);
    setDetailsOpen(false);
    setModuleData({});
    setModuleSummary("");
    onClose();
  };

  if (!open) return null;

  return (
    <>
      <div aria-hidden="true" className="fixed inset-0 bg-foreground/40 z-40" onClick={onClose} />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        className="fixed left-0 right-0 bottom-0 z-50 flex flex-col rounded-t-[28px] bg-[var(--color-surface)] max-h-[90dvh]"
        style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom, 0px))" }}
      >
        <div aria-hidden="true" className="w-10 h-[5px] mx-auto mt-3 flex-none rounded-full bg-[var(--color-border)]" />

        {/* Sheet header */}
        <header className="flex-none flex items-center gap-3 px-5 pt-3 pb-2">
          <span className={`w-12 h-12 flex-none rounded-full flex items-center justify-center ${MODULE_COLORS[module]}`}>
            {MODULE_ICONS[module]}
          </span>
          <div className="flex-1 min-w-0">
            <h2 id="sheet-title" className="font-display text-[22px] font-semibold leading-tight">
              {moduleLabel}
            </h2>
            <p className="text-[13px] text-muted-foreground font-bold">
              {activeProfile?.name ?? ""}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="w-10 h-10 flex-none rounded-full bg-[var(--color-surface-2)] flex items-center justify-center"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </header>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-5">
          {/* Module content */}
          {children
            ? children({ setData: handleSetData, setFlagged })
            : (
              <p className="text-muted-foreground text-[15px]">
                Options coming in M5.
              </p>
            )
          }

          {/* Time chip (QL-03) */}
          <div>
            <p className="text-[13px] font-extrabold text-muted-foreground mb-2 uppercase tracking-wide">When</p>
            <TimeChip value={time} onChange={setTime} />
          </div>

          {/* Add details (QL-05) */}
          <div>
            <button
              type="button"
              onClick={() => setDetailsOpen((v) => !v)}
              className="flex items-center gap-1.5 text-[14px] font-extrabold text-[var(--color-profile)]"
            >
              <ChevronDown
                size={16}
                strokeWidth={2.5}
                className={`transition-transform ${detailsOpen ? "rotate-180" : ""}`}
              />
              Add details
            </button>
            {detailsOpen && (
              <div className="mt-3 space-y-3">
                <textarea
                  placeholder="Note (optional)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  className="w-full rounded-2xl border-[1.5px] border-[var(--color-border)] bg-white px-4 py-3 text-[15px] font-bold resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-profile)]"
                />
                <label className="flex items-center gap-3 min-h-[44px]">
                  <input
                    type="checkbox"
                    checked={flagged}
                    onChange={(e) => setFlagged(e.target.checked)}
                    className="w-5 h-5 rounded accent-[var(--color-profile)]"
                  />
                  <span className="flex items-center gap-1.5 text-[15px] font-bold">
                    <Flag size={15} strokeWidth={2} />
                    Flag for doctor
                  </span>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Sticky Save */}
        <div className="flex-none px-5 pt-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className="w-full min-h-[52px] flex items-center justify-center rounded-full bg-foreground text-background text-[17px] font-extrabold disabled:opacity-60"
          >
            {pending ? <Loader2 size={20} strokeWidth={2} className="animate-spin" /> : "Save"}
          </button>
        </div>
      </section>
    </>
  );
}
