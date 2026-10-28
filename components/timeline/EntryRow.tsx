"use client";

import { CloudOff, Flag } from "lucide-react";
import { useTranslations } from "next-intl";
import { MODULE_CIRCLE, MODULE_ICONS, type ModuleType } from "@/components/log/LogSheet";
import type { LocalEntry } from "@/lib/data/types";
import { entryDetail, entryTitle, formatClock, type SummaryContext } from "@/lib/entries/summary";
import { caregiverLabel } from "@/lib/timeline";

const KNOWN = new Set(["bathroom", "eating", "activity", "mood", "medication"]);

export function EntryRow({ entry, ctx, onOpen, action }: { entry: LocalEntry; ctx: SummaryContext; onOpen?: () => void; action?: React.ReactNode }) {
  const mod = (KNOWN.has(entry.type) ? entry.type : null) as ModuleType | null;
  const detail = entryDetail(entry);
  const t = useTranslations("entry");
  const body = (
    <>
      <span className="w-[62px] flex-none text-caption font-extrabold text-foreground-2 tabular-nums">{formatClock(entry.occurred_at)}</span>
      <span className={`w-9 h-9 flex-none rounded-full flex items-center justify-center [&_svg]:w-[18px] [&_svg]:h-[18px] ${mod ? MODULE_CIRCLE[mod] : "bg-secondary"}`}>
        {mod && MODULE_ICONS[mod]}
      </span>
      <span className="flex-1 min-w-0 flex flex-col gap-0.5 text-left">
        <span className="text-body font-extrabold">{entryTitle(entry, ctx)}</span>
        {(detail || entry.flagged_for_doctor || entry._sync === "pending" || entry._sync === "failed") && (
          <span className="flex flex-wrap items-center gap-1.5 text-caption text-muted-foreground">
            {detail && <span>{detail}</span>}
            {entry.flagged_for_doctor && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-flag border border-flag-border text-flag-ink text-micro font-extrabold">
                <Flag size={12} strokeWidth={2.5} aria-hidden="true" /> {t("forDoctor")}
              </span>
            )}
            {entry._sync === "pending" && (
              <span className="inline-flex items-center gap-1 text-micro font-bold">
                <CloudOff size={12} strokeWidth={2} aria-hidden="true" /> {t("waitingSync")}
              </span>
            )}
            {entry._sync === "failed" && <span className="text-micro font-bold text-destructive">{t("syncFailed")}</span>}
          </span>
        )}
      </span>
      {action ?? (
        <span className="flex-none px-2 py-0.5 rounded-full bg-secondary text-[0.78125rem] font-extrabold text-foreground-2">
          {caregiverLabel(entry.logged_by_name, entry.logged_by_initials)}
        </span>
      )}
    </>
  );
  return onOpen ? (
    <button type="button" onClick={onOpen} className="w-full flex items-center gap-2.5 min-h-16 px-3.5 py-2 animate-fade-in">
      {body}
    </button>
  ) : (
    <div className="flex items-center gap-2.5 min-h-16 px-3.5 py-2">{body}</div>
  );
}
