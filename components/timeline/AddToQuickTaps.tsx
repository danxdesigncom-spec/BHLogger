"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Plus } from "lucide-react";
import { useFavorites } from "@/lib/data/hooks";
import { useRepo } from "@/lib/data/repo-context";
import type { LocalEntry } from "@/lib/data/types";
import { favoriteLabel, type SummaryContext } from "@/lib/entries/summary";
import { MAX_FAVORITES, parseTemplate, sameTemplate, templateFromEntry } from "@/lib/favorites";

/** QL-09: any entry can become a quick tap for its profile, up to six. */
export function AddToQuickTaps({ entry, ctx }: { entry: LocalEntry; ctx: SummaryContext }) {
  const t = useTranslations("quickTaps");
  const repo = useRepo();
  const qc = useQueryClient();
  const favorites = useFavorites(entry.profile_id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const template = templateFromEntry(entry);
  if (!template || entry.deleted_at || !favorites.data) return null;
  const exists = favorites.data.some((f) => {
    const tpl = parseTemplate(f.entry_template);
    return tpl && sameTemplate(tpl, template);
  });
  const full = favorites.data.length >= MAX_FAVORITES;

  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={busy || exists || full}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const label = entry.type === "medication" ? ctx.medicationName?.(String((entry.data as { medication_id?: string }).medication_id)) ?? favoriteLabel(entry, ctx) : favoriteLabel(entry, ctx);
          const result = await repo.addFavorite({ profileId: entry.profile_id, label: label.slice(0, 40), template });
          if ("error" in result) setError(result.error);
          await qc.invalidateQueries({ queryKey: ["favorites"] });
          setBusy(false);
        }}
        className="min-h-touch-min inline-flex items-center gap-1.5 px-4 rounded-full border-[1.5px] border-border-strong bg-card text-label font-extrabold disabled:opacity-60"
      >
        {exists ? <Check size={16} strokeWidth={2.5} aria-hidden="true" /> : <Plus size={16} strokeWidth={2} aria-hidden="true" />}
        {exists ? t("added") : full ? t("full", { max: MAX_FAVORITES }) : t("add")}
      </button>
      {error && <p role="alert" className="text-caption font-bold text-destructive">{error}</p>}
    </div>
  );
}
