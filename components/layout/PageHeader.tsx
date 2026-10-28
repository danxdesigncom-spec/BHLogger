"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

/** Top of a pushed screen: back button, optional action, title and "for Leo" line. */
export function PageHeader({
  title, subtitle, backHref, backLabel, action, showDot = true,
}: {
  title: string;
  subtitle?: ReactNode;
  backHref?: string;
  backLabel?: string;
  action?: ReactNode;
  showDot?: boolean;
}) {
  const t = useTranslations("common");
  return (
    <header className="px-5 pt-[18px] space-y-2.5">
      {(backHref || action) && (
        <div className="flex items-center justify-between gap-3">
          {backHref ? (
            <Link href={backHref} aria-label={backLabel ?? t("back")} className="w-11 h-11 flex-none rounded-full bg-card shadow-raised flex items-center justify-center">
              <ChevronLeft size={22} strokeWidth={2} aria-hidden="true" />
            </Link>
          ) : <span />}
          {action}
        </div>
      )}
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-display-2">{title}</h1>
        {subtitle && (
          <p className="flex items-center gap-1.5 text-label font-bold text-muted-foreground">
            {showDot && <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full bg-profile" />}
            {subtitle}
          </p>
        )}
      </div>
    </header>
  );
}
