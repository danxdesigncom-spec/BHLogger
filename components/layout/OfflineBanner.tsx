"use client";

import { useEffect, useState } from "react";
import { CloudOff, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePendingCount } from "@/lib/data/hooks";
import { useHousehold } from "@/lib/context/household-provider";

export function OfflineBanner() {
  const { mode } = useHousehold();
  const [online, setOnline] = useState(true);
  const pending = usePendingCount();
  const t = useTranslations("banners");

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (mode === "demo") return null;
  const count = pending.data ?? 0;
  if (online && count === 0) return null;

  return (
    <div
      role="status"
      className="print:hidden flex items-center gap-2 px-5 py-2 text-label font-bold bg-info text-info-ink border-b border-info-border"
    >
      {online ? <RefreshCw size={16} strokeWidth={2} aria-hidden="true" /> : <CloudOff size={16} strokeWidth={2} aria-hidden="true" />}
      {online ? t("syncing", { count }) : count > 0 ? t("offlinePending", { count }) : t("offline")}
    </div>
  );
}
