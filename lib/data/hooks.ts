"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useHousehold } from "@/lib/context/household-provider";
import { ProfileSettingsSchema, type ProfileSettings } from "@/lib/schemas/household";
import { demoProfileSettings } from "./demo-repo";
import { DATA_KEYS, useRepo } from "./repo-context";
import type { EntryQuery } from "./types";

export function useEntries(q: EntryQuery, enabled = true) {
  const repo = useRepo();
  return useQuery({
    queryKey: ["entries", repo.mode, q],
    queryFn: () => repo.listEntries(q),
    enabled,
    staleTime: 15_000,
  });
}

export function useLatestEntry(profileId: string | null, type: string, match?: Record<string, string>) {
  const repo = useRepo();
  return useQuery({
    queryKey: ["latest-entry", profileId, type, match ?? null, repo.mode],
    queryFn: () => repo.latestEntry(profileId!, type, match),
    enabled: !!profileId,
    staleTime: 15_000,
  });
}

export function useEntry(id: string | null) {
  const repo = useRepo();
  return useQuery({ queryKey: ["entries", "one", id, repo.mode], queryFn: () => repo.getEntry(id!), enabled: !!id });
}

export function useRevisions(entryId: string | null) {
  const repo = useRepo();
  return useQuery({ queryKey: ["revisions", entryId, repo.mode], queryFn: () => repo.listRevisions(entryId!), enabled: !!entryId });
}

export function useMedications(profileId: string | null) {
  const repo = useRepo();
  return useQuery({
    queryKey: ["medications", profileId, repo.mode],
    queryFn: () => repo.listMedications(profileId!),
    enabled: !!profileId,
    staleTime: 60_000,
  });
}

export function useMedicationChanges(profileId: string | null) {
  const repo = useRepo();
  return useQuery({
    queryKey: ["med-changes", profileId, repo.mode],
    queryFn: () => repo.listMedicationChanges(profileId!),
    enabled: !!profileId,
    staleTime: 60_000,
  });
}

export function useAppointments(profileId: string | null) {
  const repo = useRepo();
  return useQuery({ queryKey: ["appointments", profileId, repo.mode], queryFn: () => repo.listAppointments(profileId!), enabled: !!profileId });
}

export function useOptions(profileId: string | null, module: string) {
  const repo = useRepo();
  return useQuery({
    queryKey: ["options", profileId, module, repo.mode],
    queryFn: () => repo.listOptions(profileId!, module),
    enabled: !!profileId,
    staleTime: 60_000,
  });
}

export function usePendingCount() {
  const repo = useRepo();
  return useQuery({ queryKey: ["pending", repo.mode], queryFn: () => repo.pendingCount(), refetchInterval: 15_000 });
}

/** Profile alert thresholds (SET-05), with defaults filled in. */
export function useProfileSettings(profileId: string | null): ProfileSettings {
  const { profiles, mode } = useHousehold();
  const base = profiles.find((p) => p.id === profileId)?.settings ?? {};
  const demo = useQuery({
    queryKey: ["profile-settings", "demo"],
    queryFn: demoProfileSettings,
    enabled: mode === "demo",
  });
  const overrides = mode === "demo" && profileId ? demo.data?.[profileId] ?? {} : {};
  return ProfileSettingsSchema.parse({ ...base, ...overrides });
}

export function useInvalidateData() {
  const qc = useQueryClient();
  return useCallback(() => {
    for (const key of DATA_KEYS) qc.invalidateQueries({ queryKey: [key] });
  }, [qc]);
}
