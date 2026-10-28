"use client";

import { Check } from "lucide-react";
import { useHousehold } from "@/lib/context/household-provider";

const COLOR_BG: Record<string, string> = {
  violet: "bg-profile",
  teal:   "bg-profile",
  rose:   "bg-profile",
  amber:  "bg-profile",
  blue:   "bg-profile",
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ProfileSwitcherSheet({ open, onClose }: Props) {
  const { profiles, activeProfileId, setActiveProfile } = useHousehold();

  if (!open) return null;

  return (
    <>
      <div
        aria-hidden="true"
        className="fixed inset-0 bg-foreground/40 z-40"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Switch profile"
        className="fixed left-0 right-0 bottom-0 z-50 rounded-t-[28px] bg-[var(--color-card)] pb-[max(24px,env(safe-area-inset-bottom,0px))]"
      >
        <div aria-hidden="true" className="w-10 h-[5px] mx-auto mt-3 rounded-full bg-[var(--color-border)]" />
        <h2 className="font-display text-[22px] font-semibold px-5 pt-4 pb-2">
          Switch profile
        </h2>
        <ul className="px-4 pb-2 space-y-2">
          {profiles.map((p) => {
            const active = p.id === activeProfileId;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveProfile(p.id);
                    onClose();
                  }}
                  className={[
                    "w-full flex items-center gap-4 px-4 min-h-[64px] rounded-[20px] transition-colors",
                    active
                      ? "bg-[var(--color-profile-tint)] border-2 border-[var(--color-profile)]"
                      : "bg-white border-2 border-transparent",
                  ].join(" ")}
                >
                  <span
                    aria-hidden="true"
                    data-profile-color={p.color} className={`w-10 h-10 flex-none rounded-full flex items-center justify-center font-display text-[18px] font-semibold text-white ${COLOR_BG[p.color] ?? "bg-gray-400"}`}
                  >
                    {p.initials}
                  </span>
                  <span className="flex-1 text-left">
                    <span className="block text-[17px] font-extrabold">{p.name}</span>
                    <span className="block text-[13px] text-muted-foreground capitalize">
                      {p.careStage === "teen_adult" ? "Teen / Adult" : p.careStage}
                    </span>
                  </span>
                  {active && (
                    <Check size={20} strokeWidth={2.5} className="text-[var(--color-profile)] flex-none" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
