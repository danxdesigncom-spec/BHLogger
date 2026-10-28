"use client";

import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DuplicateDoseDialog } from "@/components/meds/GiveDoseSheet";
import type { ToastEntry } from "./UndoToast";
import { useHousehold } from "@/lib/context/household-provider";
import { useProfileSettings } from "@/lib/data/hooks";
import { useRepo } from "@/lib/data/repo-context";
import type { Result } from "@/lib/data/types";
import type { FavoriteTemplate } from "@/lib/favorites";
import { duplicateCheck, slotToFill, type DuplicateConflict } from "@/lib/meds/schedule";
import { recordLoggingSession } from "@/lib/install";
import { formatTime } from "@/lib/prefs";
import { t } from "@/lib/i18n";

interface SaveInput {
  profileId: string;
  type: string;
  data: Record<string, unknown>;
  summary: string;
  occurredAt?: Date;
  endedAt?: Date;
}

/**
 * Saves an entry without opening a sheet: quick taps (QL-09), "Same as last time" (QL-10) and stopped
 * timers (QL-11). Every save shows the Undo toast. A medication quick tap still goes through the
 * duplicate-dose guard (MED-07), whose dialog defaults to Cancel.
 */
export function useQuickLog(onSaved: (toast: ToastEntry) => void) {
  const repo = useRepo();
  const qc = useQueryClient();
  const { householdId, profiles, activeProfileId } = useHousehold();
  const settings = useProfileSettings(activeProfileId);
  const [conflict, setConflict] = useState<{ medName: string; profileName: string; hit: DuplicateConflict } | null>(null);
  const resolver = useRef<((proceed: boolean) => void) | null>(null);

  const save = useCallback(
    async ({ profileId, type, data, summary, occurredAt = new Date(), endedAt }: SaveInput): Promise<Result> => {
      const profile = profiles.find((p) => p.id === profileId);
      if (!profile) return { error: t("errors.profileNotFound") };
      const id = crypto.randomUUID();
      const result = await repo.saveEntry({
        id, householdId, profileId, type, data, flaggedForDoctor: false,
        occurredAt: occurredAt.toISOString(),
        endedAt: endedAt?.toISOString(),
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      if ("error" in result) return result;
      try { navigator.vibrate?.(10); } catch { /* unsupported */ }
      recordLoggingSession();
      for (const key of ["latest-entry", "entries", "pending"]) qc.invalidateQueries({ queryKey: [key] });
      onSaved({ entryId: id, householdId, profileName: profile.name, summary, time: formatTime(occurredAt) });
      return result;
    },
    [repo, qc, householdId, profiles, onSaved],
  );

  const logTemplate = useCallback(
    async (profileId: string, template: FavoriteTemplate, summary: string): Promise<Result | null> => {
      const data = { ...template.data };
      if (template.type === "medication") {
        const med = (await repo.listMedications(profileId)).find((m) => m.id === data.medication_id && m.active);
        if (!med) return { error: t("errors.medicationInactive") };
        const now = new Date();
        const doses = await repo.listEntries({ profileId, types: ["medication"], from: new Date(now.getTime() - 3 * 86_400_000).toISOString() });
        const slot = med.kind === "scheduled" ? slotToFill(med, doses, now) : null;
        data.scheduled_for = slot ? slot.toISOString() : null;
        const hit = duplicateCheck(med, doses, now, slot, settings.med_duplicate_window_min);
        if (hit) {
          setConflict({ medName: med.name, profileName: profiles.find((p) => p.id === profileId)?.name ?? "", hit });
          const proceed = await new Promise<boolean>((resolve) => { resolver.current = resolve; });
          setConflict(null);
          if (!proceed) return null;
          data.duplicate_override = true;
        }
      }
      return save({ profileId, type: template.type, data, summary });
    },
    [repo, save, settings.med_duplicate_window_min, profiles],
  );

  const decide = (proceed: boolean) => {
    resolver.current?.(proceed);
    resolver.current = null;
  };

  const dialog = conflict && (
    <DuplicateDoseDialog
      medName={conflict.medName}
      profileName={conflict.profileName}
      conflict={conflict.hit}
      onCancel={() => decide(false)}
      onConfirm={() => decide(true)}
    />
  );

  return { save, logTemplate, dialog };
}
