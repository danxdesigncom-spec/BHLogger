"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { useFavorites } from "@/lib/data/hooks";
import { useRepo } from "@/lib/data/repo-context";

/** QL-09: remove and reorder a profile's quick taps. New ones are saved from an entry in Timeline. */
export function QuickTapsManager({ profileId, canEdit }: { profileId: string; canEdit: boolean }) {
  const t = useTranslations("quickTaps");
  const repo = useRepo();
  const qc = useQueryClient();
  const favorites = useFavorites(profileId);
  const [busy, startTransition] = useTransition();
  const rows = favorites.data ?? [];

  const run = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      await qc.invalidateQueries({ queryKey: ["favorites"] });
    });

  const move = (i: number, by: -1 | 1) => {
    const ids = rows.map((r) => r.id);
    [ids[i], ids[i + by]] = [ids[i + by], ids[i]];
    run(() => repo.reorderFavorites(profileId, ids));
  };

  return (
    <section aria-labelledby="quick-h" className="space-y-2">
      <h2 id="quick-h" className="font-display text-title-5">{t("manageTitle")}</h2>
      <p className="text-caption text-muted-foreground">{rows.length ? t("manageHint") : t("none")}</p>
      {rows.length > 0 && (
        <ol className="rounded-card bg-card shadow-card divide-y divide-divider">
          {rows.map((f, i) => (
            <li key={f.id} className="min-h-[56px] flex items-center gap-1 pl-4 pr-1.5">
              <span className="flex-1 text-body font-extrabold">{f.label}</span>
              {canEdit && (
                <>
                  <button type="button" disabled={busy || i === 0} aria-label={t("moveUp", { name: f.label })} onClick={() => move(i, -1)} className="w-11 h-11 rounded-full flex items-center justify-center text-muted-foreground disabled:opacity-30">
                    <ArrowUp size={18} strokeWidth={2} aria-hidden="true" />
                  </button>
                  <button type="button" disabled={busy || i === rows.length - 1} aria-label={t("moveDown", { name: f.label })} onClick={() => move(i, 1)} className="w-11 h-11 rounded-full flex items-center justify-center text-muted-foreground disabled:opacity-30">
                    <ArrowDown size={18} strokeWidth={2} aria-hidden="true" />
                  </button>
                  <button type="button" disabled={busy} aria-label={t("remove", { name: f.label })} onClick={() => run(() => repo.removeFavorite(f.id))} className="w-11 h-11 rounded-full flex items-center justify-center text-muted-foreground">
                    <X size={18} strokeWidth={2} aria-hidden="true" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
