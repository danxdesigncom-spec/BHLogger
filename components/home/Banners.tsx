"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useDismissals } from "@/lib/dismissals";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";

export interface BannerItem {
  /** Unique per event, so a dismissed banner never returns for the same event (QL-08). */
  key: string;
  priority: number;
  icon: ReactNode;
  tone: "amber" | "warning" | "profile" | "medication";
  title: string;
  sub: string;
  /** One button on the right; or a body below the title for prompts with several answers (MOOD-06, MED-12). */
  action?: { label: string; href?: string; onClick?: () => void };
  body?: ReactNode;
}

const TONE: Record<BannerItem["tone"], string> = {
  warning: "bg-warning text-warning-ink",
  profile: "bg-profile-tint text-profile-ink",
  amber: "bg-mood text-mood-ink",
  medication: "bg-medication text-medication-ink",
};

export function Banners({ items }: { items: BannerItem[] }) {
  const { dismissed, dismiss } = useDismissals();
  const [showAll, setShowAll] = useState(false);
  const t = useTranslations("common");

  const visible = items.filter((b) => !dismissed.includes(b.key)).sort((a, b) => a.priority - b.priority);
  if (!visible.length) return null;
  const shown = showAll ? visible : visible.slice(0, 2);

  return (
    <div className="space-y-2.5">
      {shown.map((b) => (
        <section key={b.key} aria-label={b.title} className="p-3 rounded-card bg-card shadow-card space-y-3">
          <div className="flex items-center gap-3">
            <span className={`w-12 h-12 flex-none rounded-lg flex items-center justify-center [&_svg]:w-6 [&_svg]:h-6 ${TONE[b.tone]}`}>
              {b.icon}
            </span>
            <span className="flex-1 min-w-0 flex flex-col gap-0.5">
              <span className="text-body-md">{b.title}</span>
              <span className="text-label font-normal text-muted-foreground">{b.sub}</span>
            </span>
            {b.action?.href ? (
              <Link href={b.action.href} className="min-h-touch-min px-[18px] flex-none flex items-center rounded-full bg-primary text-primary-foreground text-body-md">
                {b.action.label}
              </Link>
            ) : b.action ? (
              <button type="button" onClick={b.action.onClick} className="min-h-touch-min px-[18px] flex-none rounded-full bg-primary text-primary-foreground text-body-md">
                {b.action.label}
              </button>
            ) : null}
            <button type="button" aria-label={t("dismiss", { title: b.title })} onClick={() => dismiss(b.key)} className="w-11 h-11 -mr-1.5 flex-none rounded-full flex items-center justify-center text-muted-foreground">
              <X size={18} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
          {b.body}
        </section>
      ))}
      {visible.length > 2 && !showAll && (
        <button type="button" onClick={() => setShowAll(true)} className="min-h-touch-min px-2 text-label font-extrabold text-profile-ink">
          {t("showAll", { count: visible.length })}
        </button>
      )}
    </div>
  );
}
