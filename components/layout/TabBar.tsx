"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Clock,
  BarChart2,
  FileText,
  MoreHorizontal,
} from "lucide-react";

const TABS = [
  { href: "/",          label: "Log",      icon: LayoutGrid  },
  { href: "/timeline",  label: "Timeline", icon: Clock       },
  { href: "/insights",  label: "Insights", icon: BarChart2   },
  { href: "/reports",   label: "Reports",  icon: FileText    },
  { href: "/more",      label: "More",     icon: MoreHorizontal },
] as const;

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border"
      style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom, 0px))" }}
    >
      <ul className="flex items-stretch" role="list">
        {TABS.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/"
              ? pathname === "/" || pathname.startsWith("/?")
              : pathname === href || pathname.startsWith(href + "/");
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={[
                  "flex flex-col items-center gap-0.5 pt-2 pb-1 w-full",
                  "text-micro font-display font-semibold transition-colors",
                  "min-h-[48px]",
                  isActive
                    ? "text-[var(--profile)] bg-[var(--profile-tint)]"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                <Icon
                  size={22}
                  strokeWidth={isActive ? 2.5 : 2}
                  aria-hidden="true"
                />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
