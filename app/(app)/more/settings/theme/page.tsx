"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { useTranslations } from "next-intl";
import { Group, RadioChips, Segmented } from "@/components/log/controls";
import { useTheme, type ThemePreference } from "@/lib/theme-context";
import { nightUntil } from "@/lib/night";
import { formatHour, formatTime } from "@/lib/prefs";
import { useOnClient } from "@/lib/use-on-client";

// SET-03: tap-only hour choices around the 8 PM to 6 AM default.
const STARTS = ["19:00", "20:00", "21:00", "22:00"];
const ENDS = ["05:00", "06:00", "07:00", "08:00"];
const hourLabel = (hm: string) => formatHour(Number(hm.slice(0, 2)));

export default function ThemePage() {
  const { theme, setTheme, night, nightPrefs, setNight, setNightHours } = useTheme();
  const t = useTranslations("settings");
  // "On until 6:00 AM" reads the device clock, so it appears after hydration.
  const onClient = useOnClient();
  const now = new Date();
  const until = onClient ? nightUntil(nightPrefs, now) : undefined;
  const status = !onClient
    ? null
    : night
      ? until ? t("theme.nightOnUntil", { time: formatTime(until) }) : t("theme.nightOnManual")
      : nightPrefs.auto
        ? t("theme.nightComesOn", { time: hourLabel(nightPrefs.from) })
        : t("theme.nightHint");

  return (
    <>
      <PageHeader title={t("theme.title")} backHref="/more" backLabel={t("backToMore")} showDot={false} />
      <div className="px-5 pt-3 pb-8 space-y-6">
        <Group label={t("theme.appearance")} hint={t("theme.hint")}>
          <Segmented<ThemePreference>
            label={t("theme.appearance")}
            value={theme}
            onChange={setTheme}
            options={[{ value: "light", label: t("theme.light") }, { value: "dark", label: t("theme.dark") }, { value: "system", label: t("theme.system") }]}
          />
          <p className="text-caption text-muted-foreground">{t("theme.note")}{night ? ` ${t("theme.nightReplaces")}` : ""}</p>
        </Group>

        <Group label={t("theme.nightTitle")} hint={t("theme.hint")}>
          <div className="rounded-card bg-card shadow-card divide-y divide-divider">
            <label className="flex items-center justify-between gap-3 min-h-[64px] px-4 py-2.5 cursor-pointer">
              <span className="min-w-0 flex flex-col">
                <span id="night-on" className="text-body font-extrabold">{t("theme.nightNow")}</span>
                <span id="night-status" className="text-caption text-muted-foreground min-h-[1lh]">{status}</span>
              </span>
              <input
                type="checkbox"
                role="switch"
                aria-labelledby="night-on"
                aria-describedby="night-status"
                checked={night}
                onChange={(e) => setNight(e.target.checked)}
                className="switch flex-none"
              />
            </label>
            <label className="flex items-center justify-between gap-3 min-h-[64px] px-4 py-2.5 cursor-pointer">
              <span className="min-w-0 flex flex-col">
                <span id="night-auto" className="text-body font-extrabold">{t("theme.auto")}</span>
                <span id="night-auto-hint" className="text-caption text-muted-foreground">
                  {t("theme.autoHint", { from: hourLabel(nightPrefs.from), to: hourLabel(nightPrefs.to) })}
                </span>
              </span>
              <input
                type="checkbox"
                role="switch"
                aria-labelledby="night-auto"
                aria-describedby="night-auto-hint"
                checked={nightPrefs.auto}
                onChange={(e) => setNightHours({ auto: e.target.checked })}
                className="switch flex-none"
              />
            </label>
          </div>
        </Group>

        {nightPrefs.auto && (
          <>
            <Group label={t("theme.starts")}>
              <RadioChips label={t("theme.starts")} value={nightPrefs.from} onChange={(from) => setNightHours({ from })} options={STARTS.map((hm) => ({ value: hm, label: hourLabel(hm) }))} />
            </Group>
            <Group label={t("theme.ends")}>
              <RadioChips label={t("theme.ends")} value={nightPrefs.to} onChange={(to) => setNightHours({ to })} options={ENDS.map((hm) => ({ value: hm, label: hourLabel(hm) }))} />
            </Group>
          </>
        )}
        <p className="text-caption text-muted-foreground">{t("theme.nightNote")}</p>
      </div>
    </>
  );
}
