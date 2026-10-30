"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type RefObject } from "react";
import { Check, ChevronRight, House, IdCard, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useHousehold } from "@/lib/context/household-provider";
import { ageLabel, careStageLabel } from "@/lib/options";
import { switchHousehold } from "@/lib/households/active";
import { dateLocale } from "@/lib/prefs";
import { CareCardView } from "./CareCardView";

export function ProfileSwitcherSheet({ open, onClose, opener }: { open: boolean; onClose: () => void; opener?: RefObject<HTMLElement | null> }) {
  const { profiles, activeProfileId, setActiveProfile, currentMember, householdName, otherHouseholds } = useHousehold();
  const t = useTranslations("profiles");
  // ACC-12: the care card opens inside this sheet, so it's 2 taps from any tab screen.
  const [cardFor, setCardFor] = useState<string | null>(null);
  const cardProfile = profiles.find((p) => p.id === cardFor);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const backTo = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      setCardFor(null);
      return;
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Move focus into the sheet when it opens and give it back to the pill that opened it when it closes.
  // Safari doesn't focus a button on click, so the caller passes its pill rather than relying on activeElement.
  useEffect(() => {
    if (!open) return;
    const back = opener?.current ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    titleRef.current?.focus();
    return () => back?.focus();
  }, [open, opener]);

  // Coming back from a care card, focus that person's Care card button again.
  useEffect(() => {
    if (cardFor || !backTo.current) return;
    sheetRef.current?.querySelector<HTMLElement>(`[data-card-for="${backTo.current}"]`)?.focus();
    backTo.current = null;
  }, [cardFor]);

  if (!open) return null;

  return (
    <>
      <div aria-hidden="true" className="fixed inset-0 z-40 bg-[var(--overlay)] animate-fade-in" onClick={onClose} />
      <section
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="switch-title"
        className="fixed left-0 right-0 bottom-0 z-50 rounded-t-sheet bg-card animate-sheet-in md:left-1/2 md:right-auto md:bottom-auto md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[440px] md:rounded-sheet"
        style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}
      >
        <div aria-hidden="true" className="w-10 h-[5px] mx-auto mt-2.5 rounded-full bg-grabber" />
        {cardProfile ? (
          <CareCardView
            profile={cardProfile}
            canEdit={currentMember.role === "admin"}
            onBack={() => {
              backTo.current = cardProfile.id;
              setCardFor(null);
            }}
            onClose={onClose}
          />
        ) : (
          <>
            <h2 id="switch-title" ref={titleRef} tabIndex={-1} className="font-display text-title-1 px-5 pt-4 pb-3 outline-none">{t("switchTitle")}</h2>
            {/* With more than one household, say which one these people belong to. */}
            {otherHouseholds.length > 0 && <p className="px-5 -mt-1 pb-2 text-label text-muted-foreground">{householdName}</p>}
            <ul className="px-4 space-y-2">
              {profiles.map((p) => {
                const active = p.id === activeProfileId;
                const age = ageLabel(p.dob);
                return (
                  <li key={p.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setActiveProfile(p.id);
                        onClose();
                      }}
                      className={`flex-1 min-w-0 flex items-center gap-3.5 px-3.5 min-h-16 rounded-xl border-2 text-left ${active ? "bg-profile-tint border-profile" : "bg-secondary border-transparent"}`}
                    >
                      <span aria-hidden="true" data-profile-color={p.color} className="w-9 h-9 flex-none rounded-full bg-profile text-on-profile flex items-center justify-center font-display text-title-5">
                        {p.initials}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-body-lg">{p.name}</span>
                        <span className="block text-caption text-muted-foreground">{[careStageLabel(p.careStage), age].filter(Boolean).join(" · ")}</span>
                      </span>
                      {active && <Check size={20} strokeWidth={2.5} className="flex-none text-profile" aria-hidden="true" />}
                    </button>
                    <button
                      type="button"
                      data-card-for={p.id}
                      onClick={() => setCardFor(p.id)}
                      aria-label={t("careCardFor", { name: p.name })}
                      className="w-16 min-h-16 flex-none flex flex-col items-center justify-center gap-0.5 rounded-xl bg-secondary text-micro font-extrabold text-foreground-2"
                    >
                      <IdCard size={20} strokeWidth={2} aria-hidden="true" />
                      {t("careCard")}
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
                    {t("addPerson")}
                  </Link>
                </li>
              )}
            </ul>
            {otherHouseholds.length > 0 && (
              <section aria-labelledby="other-households-h" className="px-4 pt-4 space-y-2">
                <h3 id="other-households-h" className="px-1 text-label text-muted-foreground">{t("otherHouseholds")}</h3>
                <ul className="space-y-2">
                  {otherHouseholds.map((h) => (
                    <li key={h.id}>
                      <button
                        type="button"
                        aria-label={t("switchHousehold", { name: h.name })}
                        onClick={() => switchHousehold(h.id, h.people[0]?.id)}
                        className="w-full flex items-center gap-3.5 px-3.5 min-h-16 rounded-xl bg-secondary text-left"
                      >
                        <span aria-hidden="true" className="w-9 h-9 flex-none rounded-full bg-card flex items-center justify-center text-foreground-2">
                          <House size={18} strokeWidth={2} />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-body-lg">{h.name}</span>
                          <span className="block text-caption text-muted-foreground">
                            {h.people.length ? new Intl.ListFormat(dateLocale(), { type: "conjunction" }).format(h.people.map((p) => p.name)) : t("noPeopleYet")}
                          </span>
                        </span>
                        <ChevronRight size={20} strokeWidth={2} className="flex-none text-muted-foreground" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </section>
    </>
  );
}
