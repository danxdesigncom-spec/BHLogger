"use client";

import { ChevronDown } from "lucide-react";

interface AppHeaderProps {
  title: string;
  /** Profile name shown in the switcher pill */
  profileName?: string;
  /** CSS color value for the profile dot */
  profileColor?: string;
}

export function AppHeader({
  title,
  profileName = "Profile",
}: AppHeaderProps) {
  return (
    <header
      className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-divider"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="flex items-center justify-between px-4 h-14">
        <h1 className="text-title-3 font-display font-semibold text-foreground">
          {title}
        </h1>

        {/* Profile switcher pill — wired up properly in M3 */}
        <button
          type="button"
          aria-label={`Active profile: ${profileName}. Tap to switch.`}
          className={[
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full",
            "bg-[var(--profile-tint)] text-[var(--profile-ink)]",
            "text-body font-bold transition-opacity active:opacity-70",
            "min-h-[44px]",
          ].join(" ")}
        >
          {/* Profile color dot */}
          <span
            className="w-2.5 h-2.5 rounded-full bg-[var(--profile)] flex-shrink-0"
            aria-hidden="true"
          />
          <span>{profileName}</span>
          <ChevronDown size={14} strokeWidth={2.5} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
