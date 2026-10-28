"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";

export interface BannerItem {
  /** Unique per event, so a dismissed banner never returns for the same event (QL-08). */
  key: string;
  priority: number;
  icon: ReactNode;
  tone: "amber" | "warning" | "profile";
  title: string;
  sub: string;
  action: { label: string; href?: string; onClick?: () => void };
}

const STORAGE_KEY = "bl-dismissed-banners";

function readDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function Banners({ items }: { items: BannerItem[] }) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => setDismissed(readDismissed()), []);

  const dismiss = (key: string) => {
    const next = [...dismissed, key].slice(-200);
    setDismissed(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable: dismissal lasts this session */
    }
  };

  const visible = items.filter((b) => !dismissed.includes(b.key)).sort((a, b) => a.priority - b.priority);
  if (!visible.length) return null;
  const shown = showAll ? visible : visible.slice(0, 2);

  return (
    <div className="space-y-2.5">
      {shown.map((b) => (
        <section key={b.key} aria-label={b.title} className="flex items-center gap-3 p-3 rounded-card bg-card shadow-card">
          <span
            className={`w-12 h-12 flex-none rounded-lg flex items-center justify-center ${
              b.tone === "warning" ? "bg-warning text-warning-ink" : b.tone === "profile" ? "bg-profile-tint text-profile-ink" : "bg-mood text-mood-ink"
            }`}
          >
            {b.icon}
          </span>
          <span className="flex-1 min-w-0 flex flex-col gap-0.5">
            <span className="text-body-md">{b.title}</span>
            <span className="text-label font-normal text-muted-foreground">{b.sub}</span>
          </span>
          {b.action.href ? (
            <Link href={b.action.href} className="min-h-touch-min px-[18px] flex-none flex items-center rounded-full bg-primary text-primary-foreground text-body-md">
              {b.action.label}
            </Link>
          ) : (
            <button type="button" onClick={b.action.onClick} className="min-h-touch-min px-[18px] flex-none rounded-full bg-primary text-primary-foreground text-body-md">
              {b.action.label}
            </button>
          )}
          <button type="button" aria-label={`Dismiss: ${b.title}`} onClick={() => dismiss(b.key)} className="w-11 h-11 -mr-1.5 flex-none rounded-full flex items-center justify-center text-muted-foreground">
            <X size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </section>
      ))}
      {visible.length > 2 && !showAll && (
        <button type="button" onClick={() => setShowAll(true)} className="min-h-touch-min px-2 text-label font-extrabold text-profile-ink">
          Show all {visible.length}
        </button>
      )}
    </div>
  );
}
