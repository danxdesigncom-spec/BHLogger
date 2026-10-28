"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { MODULE_CIRCLE, MODULE_ICONS } from "@/components/log/LogSheet";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useHousehold } from "@/lib/context/household-provider";
import { useTimers } from "@/lib/data/hooks";
import type { Result } from "@/lib/data/types";
import { clearTimer, formatTimer, timerMinutes, type RunningTimer } from "@/lib/timers";

interface StopInput {
  profileId: string;
  type: string;
  data: Record<string, unknown>;
  summary: string;
  occurredAt: Date;
  endedAt: Date;
}

/** QL-11: every timer running on this device, for any profile, with Stop (saves) and Discard. */
export function RunningTimers({ onStop }: { onStop: (input: StopInput) => Promise<Result> }) {
  const t = useTranslations("timer");
  const tc = useTranslations("common");
  const { profiles } = useHousehold();
  const qc = useQueryClient();
  const timers = useTimers();
  const [now, setNow] = useState(() => Date.now());
  const [discarding, setDiscarding] = useState<RunningTimer | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = (timers.data ?? []).filter((x) => profiles.some((p) => p.id === x.profileId));
  useEffect(() => {
    if (!rows.length) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [rows.length]);
  if (!rows.length) return null;

  const stop = async (x: RunningTimer) => {
    setBusy(x.key);
    setError(null);
    const endedAt = new Date();
    const result = await onStop({
      profileId: x.profileId, type: x.module, summary: x.label,
      data: { ...x.data, duration_min: timerMinutes(x.startedAt, endedAt) },
      occurredAt: new Date(x.startedAt), endedAt,
    });
    if ("error" in result) setError(result.error);
    else await clearTimer(x.key);
    await qc.invalidateQueries({ queryKey: ["timers"] });
    setBusy(null);
  };

  return (
    <section aria-label={t("running")} className="space-y-2.5">
      {rows.map((x) => {
        const profile = profiles.find((p) => p.id === x.profileId)!;
        return (
          <div key={x.key} data-profile-color={profile.color} className="flex items-center gap-3 p-3 rounded-card bg-card shadow-card">
            <span className={`w-12 h-12 flex-none rounded-full flex items-center justify-center [&_svg]:w-6 [&_svg]:h-6 ${MODULE_CIRCLE[x.module]}`}>
              {MODULE_ICONS[x.module]}
            </span>
            <span className="flex-1 min-w-0 flex flex-col gap-0.5">
              <span className="text-body-md truncate">{x.label}</span>
              <span className="flex items-center gap-1.5 text-label font-bold text-muted-foreground">
                <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full bg-profile" />
                {tc("for", { name: profile.name })} ·{" "}
                <span role="timer" className="tabular-nums text-foreground">{formatTimer(now - new Date(x.startedAt).getTime())}</span>
              </span>
            </span>
            <button
              type="button"
              disabled={busy === x.key}
              onClick={() => void stop(x)}
              className="min-h-touch-min px-[18px] flex-none rounded-full bg-primary text-primary-foreground text-body-md disabled:opacity-60"
            >
              {t("stop")}
            </button>
            <button type="button" aria-label={t("discardLabel", { name: x.label })} onClick={() => setDiscarding(x)} className="w-11 h-11 -mr-1 flex-none rounded-full flex items-center justify-center text-muted-foreground">
              <X size={18} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        );
      })}
      {error && <p role="alert" className="text-caption font-bold text-destructive">{error}</p>}
      {discarding && (
        <ConfirmDialog
          title={t("discardTitle")}
          body={t("discardBody", { name: discarding.label })}
          cancelLabel={t("keepRunning")}
          confirmLabel={t("discard")}
          destructive
          onCancel={() => setDiscarding(null)}
          onConfirm={async () => {
            const key = discarding.key;
            setDiscarding(null);
            await clearTimer(key);
            await qc.invalidateQueries({ queryKey: ["timers"] });
          }}
        />
      )}
    </section>
  );
}
