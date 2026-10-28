"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Check, Plus } from "lucide-react";
import { useHousehold } from "@/lib/context/household-provider";
import { ageLabel } from "@/lib/options";

const STAGE: Record<string, string> = { baby: "Baby", child: "Child", teen_adult: "Teen/Adult" };

export function ProfileSwitcherSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profiles, activeProfileId, setActiveProfile, currentMember } = useHousehold();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div aria-hidden="true" className="fixed inset-0 z-40 bg-[var(--overlay)] animate-fade-in" onClick={onClose} />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="switch-title"
        className="fixed left-0 right-0 bottom-0 z-50 rounded-t-sheet bg-card animate-sheet-in md:left-1/2 md:right-auto md:bottom-auto md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[440px] md:rounded-sheet"
        style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}
      >
        <div aria-hidden="true" className="w-10 h-[5px] mx-auto mt-2.5 rounded-full bg-grabber" />
        <h2 id="switch-title" className="font-display text-title-1 px-5 pt-4 pb-3">Switch profile</h2>
        <ul className="px-4 space-y-2">
          {profiles.map((p) => {
            const active = p.id === activeProfileId;
            const age = ageLabel(p.dob);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setActiveProfile(p.id);
                    onClose();
                  }}
                  className={`w-full flex items-center gap-3.5 px-3.5 min-h-16 rounded-xl border-2 text-left ${active ? "bg-profile-tint border-profile" : "bg-secondary border-transparent"}`}
                >
                  <span aria-hidden="true" data-profile-color={p.color} className="w-9 h-9 flex-none rounded-full bg-profile text-on-profile flex items-center justify-center font-display text-title-5">
                    {p.initials}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-body-lg">{p.name}</span>
                    <span className="block text-caption text-muted-foreground">{[STAGE[p.careStage], age].filter(Boolean).join(" · ")}</span>
                  </span>
                  {active && <Check size={20} strokeWidth={2.5} className="flex-none text-profile" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
          {currentMember.role === "admin" && (
            <li>
              <Link href="/profiles/new" onClick={onClose} className="w-full flex items-center gap-3.5 px-3.5 min-h-16 rounded-xl text-profile-ink text-body-md">
                <span className="w-9 h-9 flex-none rounded-full border-[1.5px] border-dashed border-dashed-line flex items-center justify-center">
                  <Plus size={18} strokeWidth={2} aria-hidden="true" />
                </span>
                Add a person
              </Link>
            </li>
          )}
        </ul>
      </section>
    </>
  );
}
