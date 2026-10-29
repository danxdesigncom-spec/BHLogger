"use client";

import { useEffect, useState } from "react";
import { Check, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useHousehold } from "@/lib/context/household-provider";
import { addReportItem, hasReportItem, removeReportItem, type ReportItem } from "@/lib/report-items";

/** DSH-12: outlined "Add to report" pill on charts and pattern cards. Tapping again takes it back out. */
export function AddToReportButton({ id, kind, title, detail }: Omit<ReportItem, "profileId">) {
  const t = useTranslations("insights.patterns");
  const { activeProfile } = useHousehold();
  const profileId = activeProfile?.id ?? "";
  const [added, setAdded] = useState(false);
  useEffect(() => setAdded(!!profileId && hasReportItem(profileId, id)), [profileId, id]);
  if (!profileId) return null;

  return (
    <button
      type="button"
      aria-pressed={added}
      aria-label={added ? t("inReportLabel", { title }) : t("addToReportLabel", { title })}
      onClick={() => {
        if (added) removeReportItem(profileId, id);
        else addReportItem({ id, profileId, kind, title, detail });
        setAdded(!added);
      }}
      className={`flex-none min-h-touch-min px-3.5 flex items-center gap-1.5 rounded-full border-[1.5px] text-label font-extrabold ${added ? "border-profile bg-profile-tint text-profile-ink" : "border-border-strong"}`}
    >
      {added ? <Check size={16} strokeWidth={2.5} aria-hidden="true" /> : <Plus size={16} strokeWidth={2} aria-hidden="true" />}
      {added ? t("inReport") : t("addToReport")}
    </button>
  );
}
