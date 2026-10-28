"use client";

import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from "react";
import type { ProfileColor, Toileting } from "@/lib/supabase/types";
import { HouseholdSettingsSchema, type HouseholdSettings } from "@/lib/schemas/household";
import { setDisplayPrefs } from "@/lib/prefs";

export interface ProfileSummary {
  id: string;
  name: string;
  color: ProfileColor;
  initials: string;
  careStage: "baby" | "child" | "teen_adult";
  dob: string | null;
  toileting: Toileting;
  feedingMethods: string[];
  enabledModules: string[];
  settings: Record<string, unknown>;
  careCard: Record<string, unknown>;
}

export interface MemberSummary {
  id: string;
  userId: string;
  displayName: string;
  initials: string;
  role: "admin" | "caregiver" | "viewer";
  restrictedProfileIds: string[]; // empty = full access
  accessFrom: string | null;
}

interface HouseholdContextValue {
  mode: "live" | "demo";
  householdId: string;
  householdName: string;
  householdSettings: HouseholdSettings;
  profiles: ProfileSummary[];
  archivedProfiles: ProfileSummary[];
  members: MemberSummary[];
  currentMember: MemberSummary;
  activeProfileId: string | null;
  activeProfile: ProfileSummary | null;
  setActiveProfile: (id: string) => void;
}

const HouseholdContext = createContext<HouseholdContextValue | null>(null);

export function HouseholdProvider({
  children,
  mode = "live",
  householdId,
  householdName = "",
  householdSettings,
  profiles,
  archivedProfiles = [],
  members,
  currentMember,
  initialActiveProfileId,
}: {
  children: ReactNode;
  mode?: "live" | "demo";
  householdId: string;
  householdName?: string;
  householdSettings?: unknown;
  profiles: ProfileSummary[];
  archivedProfiles?: ProfileSummary[];
  members: MemberSummary[];
  currentMember: MemberSummary;
  initialActiveProfileId: string | null;
}) {
  const settings = HouseholdSettingsSchema.parse(householdSettings ?? {});
  // SET-01: time format and week start for every formatter (client only).
  setDisplayPrefs({ timeFormat: settings.time_format, weekStart: settings.week_start });

  const [activeProfileId, setActiveProfileIdState] = useState<string | null>(
    initialActiveProfileId ?? profiles[0]?.id ?? null,
  );

  const setActiveProfile = useCallback((id: string) => {
    setActiveProfileIdState(id);
    document.cookie = `bl-active-profile=${id}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  }, []);

  // Non-negotiable 4: the accent always follows the active profile (data-profile-color on <html>).
  const activeColor = profiles.find((p) => p.id === activeProfileId)?.color;
  useEffect(() => {
    if (!activeColor) return;
    document.documentElement.setAttribute("data-profile-color", activeColor);
    document.cookie = `bl-profile-color=${activeColor}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  }, [activeColor]);

  return (
    <HouseholdContext.Provider
      value={{
        mode,
        householdId,
        householdName,
        householdSettings: settings,
        profiles,
        archivedProfiles,
        members,
        currentMember,
        activeProfileId,
        activeProfile: profiles.find((p) => p.id === activeProfileId) ?? null,
        setActiveProfile,
      }}
    >
      {children}
    </HouseholdContext.Provider>
  );
}

export function useHousehold() {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error("useHousehold must be used within HouseholdProvider");
  return ctx;
}
