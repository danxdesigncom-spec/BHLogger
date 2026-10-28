"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SquarePlus, List, ChartNoAxesColumn, FileText, Ellipsis } from "lucide-react";

const TABS = [
  { href: "/",         label: "Log",      icon: SquarePlus },
  { href: "/timeline", label: "Timeline", icon: List },
  { href: "/insights", label: "Insights", icon: ChartNoAxesColumn },
  { href: "/reports",  label: "Reports",  icon: FileText },
  { href: "/more",     label: "More",     icon: Ellipsis },
] as const;

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="print:hidden fixed left-4 right-4 z-40 h-tabbar p-1.5 grid grid-cols-5 gap-0.5 rounded-[34px] bg-card shadow-float lg:right-auto lg:top-4 lg:!bottom-4 lg:w-[240px] lg:h-auto lg:grid-cols-1 lg:auto-rows-[52px] lg:content-start lg:gap-1 lg:p-3 lg:rounded-tile"
      style={{ bottom: "calc(18px + env(safe-area-inset-bottom, 0px))" }}
    >
      {TABS.map(({ href, label, icon: Icon }) => {
        const isActive = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={[
              "flex flex-col items-center justify-center gap-0.5 rounded-[28px] text-micro font-extrabold transition-colors lg:flex-row lg:justify-start lg:gap-3 lg:px-4 lg:text-body",
              isActive ? "bg-profile-tint text-profile" : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            <Icon size={22} strokeWidth={2} aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
