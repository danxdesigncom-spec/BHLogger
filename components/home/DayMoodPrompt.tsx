"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { MODULE_ICONS } from "@/components/log/LogSheet";
import { FaceScale } from "@/components/log/controls";
import type { BannerItem } from "./Banners";
import { useEntries } from "@/lib/data/hooks";
import type { Result } from "@/lib/data/types";
import type { ProfileSummary } from "@/lib/context/household-provider";
import { useNow } from "@/lib/dismissals";
import { moodLabels } from "@/lib/options";
import { startOfDay, ymd } from "@/lib/dates";

export const DAY_PROMPT_HOUR = 18;

type Save = (input: { profileId: string; type: string; data: Record<string, unknown>; summary: string }) => Promise<Result>;

/** MOOD-06: after 6 PM, a Home banner where one face stores today's day-level mood. */
export function useDayMoodBanner(profile: ProfileSummary | null | undefined, enabled: boolean, onSave: Save): BannerItem | null {
  const t = useTranslations();
  const now = useNow();
  const evening = now.getHours() >= DAY_PROMPT_HOUR;
  const from = useMemo(() => startOfDay(now).toISOString(), [now]);
  const moods = useEntries({ profileId: profile?.id, types: ["mood"], from }, enabled && evening && !!profile);

  if (!profile || !enabled || !evening || !moods.isFetched) return null;
  if ((moods.data ?? []).some((e) => (e.data as { scope?: string }).scope === "day")) return null;

  const labels = moodLabels(profile.careStage);
  const title = t("moodSheet.dayQuestion");
  return {
    key: `daymood-${profile.id}-${ymd(now)}`,
    priority: 4,
    tone: "amber",
    icon: MODULE_ICONS.mood,
    title,
    sub: t("dayMood.forName", { name: profile.name }),
    body: (
      <FaceScale
        label={title}
        labels={labels}
        value={null}
        onChange={(level) =>
          void onSave({
            profileId: profile.id, type: "mood",
            data: { scope: "day", level, feelings: [], behaviors: [] },
            summary: t("summary.dayOverall", { title: labels[level - 1] }),
          })
        }
      />
    ),
  };
}
