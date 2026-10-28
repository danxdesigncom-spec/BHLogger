"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { MODULE_ICONS } from "@/components/log/LogSheet";
import type { BannerItem } from "./Banners";
import { useHousehold } from "@/lib/context/household-provider";
import { useEntries, useMedications } from "@/lib/data/hooks";
import { useRepo } from "@/lib/data/repo-context";
import type { LocalEntry } from "@/lib/data/types";
import { useNow } from "@/lib/dismissals";
import { labelFor, PRN_FOLLOWUPS, PRN_REASONS } from "@/lib/options";
import { formatClock } from "@/lib/entries/summary";
import { followupDue } from "@/lib/meds/followup";

function FollowupChoices({ dose }: { dose: LocalEntry }) {
  const repo = useRepo();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const answer = async (followup: string) => {
    setBusy(true);
    setError(null);
    const result = await repo.updateEntry(dose.id, { data: { ...(dose.data as Record<string, unknown>), followup } });
    if ("error" in result) setError(result.error);
    for (const key of ["entries", "latest-entry", "revisions"]) await qc.invalidateQueries({ queryKey: [key] });
    setBusy(false);
  };

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {PRN_FOLLOWUPS.map((f) => (
          <button
            key={f.key}
            type="button"
            disabled={busy}
            onClick={() => void answer(f.key)}
            className="min-h-touch-min px-2 rounded-full border-[1.5px] border-border-strong bg-card text-label font-extrabold disabled:opacity-60"
          >
            {f.label}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="text-caption font-bold text-destructive">{error}</p>}
    </>
  );
}

/**
 * MED-12: from 30 minutes after an as-needed dose, a Home banner asks whether it helped; the answer is saved on the dose.
 * Only the person who gave it, or an admin, may change the entry (ACC-09), so only they are asked.
 */
export function useFollowupBanners(profileId: string | null, enabled: boolean): BannerItem[] {
  const t = useTranslations("followup");
  const { currentMember } = useHousehold();
  const now = useNow();
  const from = useMemo(() => new Date(now.getTime() - 5 * 3_600_000).toISOString(), [now]);
  const doses = useEntries({ profileId: profileId ?? undefined, types: ["medication"], from }, enabled && !!profileId);
  const meds = useMedications(enabled ? profileId : null);

  if (!enabled || !profileId) return [];
  const prnIds = new Set((meds.data ?? []).filter((m) => m.kind === "prn").map((m) => m.id));
  return followupDue(doses.data ?? [], prnIds, now, currentMember).map((dose) => {
    const data = dose.data as { medication_id: string; prn_reason?: string | null };
    const name = meds.data?.find((m) => m.id === data.medication_id)?.name ?? "";
    return {
      key: `followup-${dose.id}`,
      priority: 2.5,
      tone: "medication" as const,
      icon: MODULE_ICONS.medication,
      title: t("question", { name }),
      sub: data.prn_reason
        ? t("givenFor", { time: formatClock(dose.occurred_at), reason: labelFor(PRN_REASONS, data.prn_reason).toLowerCase() })
        : t("given", { time: formatClock(dose.occurred_at) }),
      body: <FollowupChoices dose={dose} />,
    };
  });
}
