"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

const VIEWS = [
  { href: "/insights", key: "today" },
  { href: "/insights/trends", key: "trends" },
  { href: "/insights/patterns", key: "patterns" },
] as const;

export function InsightsNav() {
  const pathname = usePathname();
  const t = useTranslations("insights.views");
  return (
    <nav aria-label={t("label")} className="grid grid-cols-3 gap-1 p-[3px] rounded-full border border-border bg-card">
      {VIEWS.map((v) => {
        const current = pathname === v.href;
        return (
          <Link
            key={v.href}
            href={v.href}
            aria-current={current ? "page" : undefined}
            className={`min-h-touch-min flex items-center justify-center rounded-full text-body ${current ? "bg-profile text-on-profile font-extrabold" : "text-foreground"}`}
          >
            {t(v.key)}
          </Link>
        );
      })}
    </nav>
  );
}
