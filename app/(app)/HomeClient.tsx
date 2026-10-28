"use client";

import { useState, useCallback } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useHousehold } from "@/lib/context/household-provider";
import { useLatestEntry } from "@/lib/hooks/useLatestEntry";
import { ProfileSwitcherSheet } from "@/components/profile/ProfileSwitcherSheet";
import { LogSheet, type ModuleType } from "@/components/log/LogSheet";
import { ModuleTile } from "@/components/log/ModuleTile";
import { UndoToast, type ToastEntry } from "@/components/log/UndoToast";
import { BathroomSheet } from "@/components/log/modules/BathroomSheet";
import { EatingSheet } from "@/components/log/modules/EatingSheet";
import { FeedingSheet } from "@/components/log/modules/FeedingSheet";
import { ActivitySheet } from "@/components/log/modules/ActivitySheet";
import { MoodSheet } from "@/components/log/modules/MoodSheet";
import { undoEntry } from "@/lib/actions/entries";
import { useQueryClient } from "@tanstack/react-query";

// ─── Profile color map ────────────────────────────────────────────────────────

const COLOR_BG: Record<string, string> = {
  violet: "bg-[var(--color-profile-violet)]",
  teal:   "bg-[var(--color-profile-teal)]",
  rose:   "bg-[var(--color-profile-rose)]",
  amber:  "bg-[var(--color-profile-amber)]",
  blue:   "bg-[var(--color-profile-blue)]",
};

// ─── Module icon SVGs ─────────────────────────────────────────────────────────

function BathroomIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M12 2a5 5 0 0 1 5 5v1H7V7a5 5 0 0 1 5-5Z"/>
      <path d="M6 8h12l-1.5 11H7.5L6 8Z"/>
    </svg>
  );
}
function EatingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/>
      <path d="M21 15V2a5 5 0 0 0-5 5v6h3v2a3 3 0 0 1-3 3h-1"/>
    </svg>
  );
}
function MoodIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="12" cy="12" r="10"/>
      <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
      <line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
    </svg>
  );
}
function ActivityIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  );
}
function MedIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/>
      <path d="m8.5 8.5 7 7"/>
    </svg>
  );
}

// ─── Relative time formatter ──────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs} h ago`;
  const days = Math.floor(hrs / 24);
  return `${days} d ago`;
}

// ─── Tile status formatters ───────────────────────────────────────────────────

function bathroomStatus(entry: { occurred_at: string; data: unknown } | null, isBaby: boolean): { status: string | null; alert: string | null } {
  if (!entry) return { status: "Nothing logged yet", alert: null };
  const data = entry.data as Record<string, unknown>;
  const t = data?.type as string;
  const label = t === "pee" ? (isBaby ? "Wet" : "Pee") : t === "bm" ? (isBaby ? "Dirty" : "BM") : "Both";
  return { status: `${label} · ${relativeTime(entry.occurred_at)}`, alert: null };
}

function simpleStatus(entry: { occurred_at: string } | null): string | null {
  if (!entry) return "Nothing logged yet";
  return relativeTime(entry.occurred_at);
}

// ─── Main component ───────────────────────────────────────────────────────────

type SheetModule = ModuleType | null;

export function HomeClient() {
  const { profiles, activeProfileId, setActiveProfile } = useHousehold();
  const qc = useQueryClient();

  const activeProfile = profiles.find((p) => p.id === activeProfileId);
  const isBaby = activeProfile?.careStage === "baby";
  const otherProfiles = profiles.filter((p) => p.id !== activeProfileId);

  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [openSheet, setOpenSheet] = useState<SheetModule>(null);
  const [toast, setToast] = useState<ToastEntry | null>(null);

  // Tile status queries
  const bathroom = useLatestEntry(activeProfileId, "bathroom");
  const eating   = useLatestEntry(activeProfileId, "eating");
  const mood     = useLatestEntry(activeProfileId, "mood");
  const activity = useLatestEntry(activeProfileId, "activity");
  const medication = useLatestEntry(activeProfileId, "medication");

  const dismissToast = useCallback(() => setToast(null), []);

  const handleUndo = useCallback(async (entryId: string, householdId: string) => {
    setToast(null);
    await undoEntry(entryId, householdId);
    qc.invalidateQueries({ queryKey: ["latest-entry", activeProfileId] });
  }, [activeProfileId, qc]);

  const { status: bathroomStatusText, alert: bathroomAlert } = bathroomStatus(bathroom.data ?? null, isBaby);

  return (
    <>
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 bg-[var(--color-surface)]/95 backdrop-blur-sm">
        <div
          className="flex items-center justify-between px-4 h-14"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          {/* Profile switcher pill */}
          <button
            type="button"
            aria-label={`Active profile: ${activeProfile?.name ?? "Profile"}. Tap to switch.`}
            onClick={() => setSwitcherOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 min-h-[44px] rounded-full bg-[var(--color-profile-bg)] text-[var(--color-profile)] font-extrabold text-[15px]"
          >
            <span
              aria-hidden="true"
              className={`w-7 h-7 rounded-full flex items-center justify-center font-display text-[13px] font-semibold text-white ${COLOR_BG[activeProfile?.color ?? "violet"] ?? ""}`}
            >
              {activeProfile?.initials ?? "?"}
            </span>
            {activeProfile?.name ?? "Profile"}
            <ChevronDown size={14} strokeWidth={2.5} />
          </button>

          {/* Secondary profile shortcut */}
          {otherProfiles[0] && (
            <button
              type="button"
              aria-label={`Switch to ${otherProfiles[0].name}`}
              onClick={() => setActiveProfile(otherProfiles[0].id)}
              className={`w-10 h-10 rounded-full flex items-center justify-center font-display text-[15px] font-semibold text-white ${COLOR_BG[otherProfiles[0].color] ?? ""}`}
            >
              {otherProfiles[0].initials}
            </button>
          )}
        </div>
      </header>

      {/* ── Body ── */}
      <div className="px-4 pt-2 pb-4 space-y-4">
        {/* Greeting */}
        <h1 className="font-display text-[32px] font-semibold leading-tight">
          How&rsquo;s {activeProfile?.name ?? "they"} doing?
        </h1>

        {/* Empty state for first-run */}
        {!bathroom.data && !eating.data && !mood.data && !activity.data && !medication.data && (
          <div className="rounded-[20px] bg-white p-4 space-y-1.5">
            <p className="font-extrabold text-[15px]">Nothing logged yet</p>
            <ul className="text-[13px] text-muted-foreground space-y-1">
              <li>• Tap a tile to log in 3 taps or fewer</li>
              <li>• Entries sync to every caregiver instantly</li>
              <li>• Use the Undo button if you make a mistake</li>
            </ul>
          </div>
        )}

        {/* Module tile grid */}
        <div className="grid grid-cols-2 gap-3">
          <ModuleTile
            module="bathroom"
            label={isBaby ? "Diaper" : "Bathroom"}
            icon={<BathroomIcon />}
            status={bathroomStatusText}
            alertPill={bathroomAlert}
            onClick={() => setOpenSheet("bathroom")}
          />
          <ModuleTile
            module="eating"
            label={isBaby ? "Feeding" : "Eating"}
            icon={<EatingIcon />}
            status={simpleStatus(eating.data ?? null)}
            onClick={() => setOpenSheet("eating")}
          />
          <ModuleTile
            module="mood"
            label="Mood"
            icon={<MoodIcon />}
            status={simpleStatus(mood.data ?? null)}
            onClick={() => setOpenSheet("mood")}
          />
          <ModuleTile
            module="activity"
            label="Activity"
            icon={<ActivityIcon />}
            status={simpleStatus(activity.data ?? null)}
            onClick={() => setOpenSheet("activity")}
          />

          {/* Medication — full width */}
          <button
            type="button"
            onClick={() => setOpenSheet("medication")}
            className="col-span-2 flex items-center gap-4 px-4 min-h-[72px] rounded-[20px] bg-[var(--module-medication)] text-left transition-opacity active:opacity-75"
          >
            <span className="w-10 h-10 flex-none rounded-full bg-white/70 text-[var(--module-medication-ink)] flex items-center justify-center">
              <MedIcon />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[17px] font-extrabold text-[var(--module-medication-ink)]">Medication</p>
              <p className="text-[13px] font-bold text-[var(--module-medication-ink)] opacity-80">
                {simpleStatus(medication.data ?? null)}
              </p>
            </div>
            <ChevronRight size={18} strokeWidth={2} className="text-[var(--module-medication-ink)] opacity-60 flex-none" />
          </button>
        </div>

        {/* Quick taps — P1 stubs */}
        <div>
          <p className="text-[15px] font-extrabold mb-3">Quick taps</p>
          <div className="flex gap-3">
            {[
              { label: isBaby ? "Wet diaper" : "Pee", icon: <BathroomIcon /> },
              { label: isBaby ? "Dirty diaper" : "BM", icon: <BathroomIcon /> },
            ].map(({ label, icon }) => (
              <button
                key={label}
                type="button"
                aria-label={`${label} (quick tap — coming soon)`}
                disabled
                className="flex flex-col items-center gap-1 opacity-50"
              >
                <span className="w-14 h-14 rounded-full bg-white shadow-sm flex items-center justify-center text-[var(--module-bathroom-ink)]">
                  {icon}
                </span>
                <span className="text-[12px] font-bold text-muted-foreground">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Profile switcher sheet ── */}
      <ProfileSwitcherSheet open={switcherOpen} onClose={() => setSwitcherOpen(false)} />

      {/* ── Bathroom log sheet ── */}
      <LogSheet
        module="bathroom"
        moduleLabel={isBaby ? "Diaper" : "Bathroom"}
        open={openSheet === "bathroom"}
        onClose={() => setOpenSheet(null)}
        onSaved={setToast}
      >
        {(ctx) => <BathroomSheet ctx={ctx} />}
      </LogSheet>

      {/* ── Eating / Feeding log sheet ── */}
      <LogSheet
        module="eating"
        moduleLabel={isBaby ? "Feeding" : "Eating"}
        open={openSheet === "eating"}
        onClose={() => setOpenSheet(null)}
        onSaved={setToast}
      >
        {(ctx) => isBaby ? <FeedingSheet ctx={ctx} /> : <EatingSheet ctx={ctx} />}
      </LogSheet>

      {/* ── Activity log sheet ── */}
      <LogSheet
        module="activity"
        moduleLabel="Activity"
        open={openSheet === "activity"}
        onClose={() => setOpenSheet(null)}
        onSaved={setToast}
      >
        {(ctx) => <ActivitySheet ctx={ctx} />}
      </LogSheet>

      {/* ── Mood log sheet ── */}
      <LogSheet
        module="mood"
        moduleLabel="Mood"
        open={openSheet === "mood"}
        onClose={() => setOpenSheet(null)}
        onSaved={setToast}
      >
        {(ctx) => <MoodSheet ctx={ctx} />}
      </LogSheet>

      {/* ── Medication log sheet (stub — M6) ── */}
      <LogSheet
        module="medication"
        moduleLabel="Medication"
        open={openSheet === "medication"}
        onClose={() => setOpenSheet(null)}
        onSaved={setToast}
      />

      {/* ── Undo toast ── */}
      <UndoToast toast={toast} onUndo={handleUndo} onDismiss={dismissToast} />
    </>
  );
}
