"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { exitDemoMode } from "@/app/auth/demo/actions";
import { clearDemoData } from "@/lib/data/demo-repo";

export function DemoBanner() {
  const [pending, startTransition] = useTransition();
  const t = useTranslations("banners");

  return (
    <div
      role="status"
      className="print:hidden flex items-center justify-between gap-3 px-5 py-2 text-label font-bold border-b bg-warning text-warning-ink border-warning-border"
      style={{ paddingTop: "max(8px, env(safe-area-inset-top, 0px))" }}
    >
      <span>{t("demo")}</span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await clearDemoData();
            await exitDemoMode();
          })
        }
        className="min-h-[36px] px-3 rounded-full bg-card font-extrabold disabled:opacity-60"
      >
        {t("exit")}
      </button>
    </div>
  );
}
