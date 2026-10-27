"use client";

import {
  createContext,
  useContext,
  useCallback,
  useState,
  type ReactNode,
} from "react";
import type { ProfileColor } from "@/lib/supabase/types";

export interface ProfileSummary {
  id: string;
  name: string;
  color: ProfileColor;
  initials: string;
  careStage: "baby" | "child" | "teen_adult";
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
  householdId: string;
  profiles: ProfileSummary[];
  members: MemberSummary[];
  currentMember: MemberSummary;
  activeProfileId: string | null;
  setActiveProfile: (id: string) => void;
}

const HouseholdContext = createContext<HouseholdContextValue | null>(null);

export function HouseholdProvider({
  children,
  householdId,
  profiles,
  members,
  currentMember,
  initialActiveProfileId,
}: {
  children: ReactNode;
  householdId: string;
  profiles: ProfileSummary[];
  members: MemberSummary[];
  currentMember: MemberSummary;
  initialActiveProfileId: string | null;
}) {
  const [activeProfileId, setActiveProfileIdState] = useState<string | null>(
    initialActiveProfileId ?? profiles[0]?.id ?? null,
  );

  const setActiveProfile = useCallback((id: string) => {
    setActiveProfileIdState(id);
    const profile = profiles.find((p) => p.id === id);
    if (profile) {
      document.documentElement.setAttribute("data-profile-color", profile.color);
      document.cookie = `bl-profile-color=${profile.color}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    }
    document.cookie = `bl-active-profile=${id}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  }, [profiles]);

  return (
    <HouseholdContext.Provider
      value={{
        householdId,
        profiles,
        members,
        currentMember,
        activeProfileId,
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
