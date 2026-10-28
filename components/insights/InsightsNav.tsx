"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const VIEWS = [
  { href: "/insights", label: "Today" },
  { href: "/insights/trends", label: "Trends" },
  { href: "/insights/patterns", label: "Patterns" },
];

export function InsightsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Insights views" className="grid grid-cols-3 gap-1 p-[3px] rounded-full border border-border bg-card">
      {VIEWS.map((v) => {
        const current = pathname === v.href;
        return (
          <Link
            key={v.href}
            href={v.href}
            aria-current={current ? "page" : undefined}
            className={`min-h-touch-min flex items-center justify-center rounded-full text-body ${current ? "bg-profile text-on-profile font-extrabold" : "text-foreground"}`}
          >
            {v.label}
          </Link>
        );
      })}
    </nav>
  );
}
