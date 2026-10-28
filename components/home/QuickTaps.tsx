"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Milk } from "lucide-react";
import { MODULE_ICONS, type ModuleType } from "@/components/log/LogSheet";
import { ActivityIcon } from "@/components/log/activity-icons";
import { useFavorites } from "@/lib/data/hooks";
import { parseTemplate, type FavoriteTemplate } from "@/lib/favorites";
import type { Result } from "@/lib/data/types";

const CUP = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 4h12l-1.5 15a2 2 0 0 1-2 1.8h-5a2 2 0 0 1-2-1.8z" />
    <path d="M6.5 9h11" />
  </svg>
);

function iconFor(tpl: FavoriteTemplate): ReactNode {
  if (tpl.type === "eating" && tpl.data.method === "drink") return CUP;
  if (tpl.type === "eating" && tpl.data.method === "bottle") return <Milk strokeWidth={2} aria-hidden="true" />;
  if (tpl.type === "activity") return <ActivityIcon id={String(tpl.data.activity_id ?? "")} />;
  return MODULE_ICONS[tpl.type as ModuleType] ?? null;
}

/** QL-09 / DESIGN 4.5: up to six one-tap presets; each logs at the current time and shows the Undo toast. */
export function QuickTaps({ profileId, onTap }: { profileId: string; onTap: (template: FavoriteTemplate, label: string) => Promise<Result | null> }) {
  const t = useTranslations("quickTaps");
  const favorites = useFavorites(profileId);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = (favorites.data ?? []).flatMap((f) => {
    const tpl = parseTemplate(f.entry_template);
    return tpl ? [{ id: f.id, label: f.label, tpl }] : [];
  });
  if (!rows.length) return null;

  return (
    <section aria-labelledby="quick-taps-h" className="space-y-2.5">
      <h2 id="quick-taps-h" className="font-display text-title-4">{t("title")}</h2>
      <div className="flex flex-wrap gap-x-[14px] gap-y-3">
        {rows.map((r) => (
          <button
            key={r.id}
            type="button"
            disabled={busy !== null}
            onClick={async () => {
              setBusy(r.id);
              setError(null);
              const result = await onTap(r.tpl, r.label);
              if (result && "error" in result) setError(result.error);
              setBusy(null);
            }}
            className="w-[76px] flex flex-col items-center gap-1.5 text-caption font-extrabold text-foreground text-center disabled:opacity-60"
          >
            <span className="w-[60px] h-[60px] rounded-full bg-card shadow-raised text-profile flex items-center justify-center [&_svg]:w-6 [&_svg]:h-6">
              {iconFor(r.tpl)}
            </span>
            {r.label}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="text-caption font-bold text-destructive">{error}</p>}
    </section>
  );
}
