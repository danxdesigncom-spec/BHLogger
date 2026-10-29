"use client";

import { useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useHousehold } from "@/lib/context/household-provider";
import { ProfileSwitcherSheet } from "@/components/profile/ProfileSwitcherSheet";

/** Tab screen header: page title plus the profile switcher pill (DESIGN 4.2). */
export function AppHeader({ title, children }: { title: string; children?: ReactNode }) {
  const { activeProfile, profiles } = useHousehold();
  const [open, setOpen] = useState(false);
  const pill = useRef<HTMLButtonElement>(null);
  const t = useTranslations("common");

  return (
    <header className="px-5 pt-[18px] pb-1 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-display-2">{title}</h1>
        {profiles.length > 0 && (
          <button
            ref={pill}
            type="button"
            aria-label={t("switchProfile", { name: activeProfile?.name ?? "" })}
            onClick={() => setOpen(true)}
            className="min-h-touch-min flex items-center gap-2 py-1.5 pl-1.5 pr-3 rounded-full bg-card shadow-raised"
          >
            <span aria-hidden="true" data-initial={activeProfile?.initials} className="w-8 h-8 rounded-full bg-profile text-on-profile flex items-center justify-center font-display text-body-md before:content-[attr(data-initial)]" />
            <span className="text-body font-extrabold">{activeProfile?.name}</span>
            <ChevronDown size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        )}
      </div>
      {children}
      <ProfileSwitcherSheet open={open} onClose={() => setOpen(false)} opener={pill} />
    </header>
  );
}
