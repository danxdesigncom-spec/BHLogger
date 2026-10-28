"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { Group, RadioChips, Segmented, Stepper } from "@/components/log/controls";
import { useHousehold } from "@/lib/context/household-provider";
import { useProfileSettings } from "@/lib/data/hooks";
import { useRepo } from "@/lib/data/repo-context";
import { updateHousehold } from "@/lib/actions/settings";
import { formatHour } from "@/lib/prefs";

export default function UnitsAndAlertsPage() {
  const { householdId, householdSettings, profiles, activeProfileId, currentMember } = useHousehold();
  const repo = useRepo();
  const router = useRouter();
  const qc = useQueryClient();
  const t = useTranslations("settings.units");
  const tc = useTranslations();
  const isAdmin = currentMember.role === "admin";
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const [profileId, setProfileId] = useState(activeProfileId ?? profiles[0]?.id ?? "");
  const profile = profiles.find((p) => p.id === profileId);
  const settings = useProfileSettings(profileId || null);
  const [alerts, setAlerts] = useState(settings);
  useEffect(() => setAlerts(settings), [profileId, settings.bm_alert_days, settings.wet_diaper_min, settings.med_dose_window_min, settings.med_duplicate_window_min]); // eslint-disable-line react-hooks/exhaustive-deps
  const wetBy = (alerts as { wet_diaper_by?: string }).wet_diaper_by ?? "18:00";

  const setHousehold = (patch: Record<string, string>) =>
    startTransition(async () => {
      const r = await updateHousehold(householdId, { settings: patch });
      setMessage("error" in r ? r.error : tc("common.saved"));
      router.refresh();
    });

  const saveAlerts = () =>
    startTransition(async () => {
      const r = await repo.updateProfileSettings(profileId, {
        bm_alert_days: alerts.bm_alert_days,
        wet_diaper_min: alerts.wet_diaper_min,
        wet_diaper_by: wetBy,
        med_dose_window_min: alerts.med_dose_window_min,
        med_duplicate_window_min: alerts.med_duplicate_window_min,
      });
      setMessage("error" in r ? r.error : t("alertsSaved", { name: profile?.name ?? "" }));
      await qc.invalidateQueries({ queryKey: ["profile-settings"] });
      router.refresh();
    });

  return (
    <>
      <PageHeader title={t("title")} backHref="/more" backLabel={tc("settings.backToMore")} showDot={false} />
      <div className="px-5 pt-3 pb-8 space-y-6">
        <section aria-labelledby="units-h" className="space-y-4">
          <h2 id="units-h" className="font-display text-title-5">{t("formats")}</h2>
          {!isAdmin && <p className="text-caption text-muted-foreground">{t("adminOnlyHousehold")}</p>}
          <fieldset disabled={!isAdmin || pending} className="space-y-4 disabled:opacity-60">
            <Group label={t("volume")}>
              <Segmented label={t("volume")} value={householdSettings.volume_unit} onChange={(v) => setHousehold({ volume_unit: v })} options={[{ value: "oz", label: t("oz") }, { value: "ml", label: t("ml") }]} />
            </Group>
            <Group label={t("time")}>
              <Segmented label={t("timeFormat")} value={householdSettings.time_format} onChange={(v) => setHousehold({ time_format: v })} options={[{ value: "12h", label: t("h12") }, { value: "24h", label: t("h24") }]} />
            </Group>
            <Group label={t("weekStartsGroup")}>
              <Segmented label={t("weekStarts")} value={householdSettings.week_start} onChange={(v) => setHousehold({ week_start: v })} options={[{ value: "sunday", label: t("sunday") }, { value: "monday", label: t("monday") }]} />
            </Group>
          </fieldset>
        </section>

        <section aria-labelledby="alerts-h" className="space-y-4">
          <h2 id="alerts-h" className="font-display text-title-5">{t("alerts")}</h2>
          <RadioChips label={t("profile")} value={profileId} onChange={setProfileId} options={profiles.map((p) => ({ value: p.id, label: p.name }))} />

          <Group label={t("bmDays")} hint={t("bmDaysHint")}>
            <Stepper
              display={alerts.bm_alert_days === null ? tc("common.off") : t("days", { count: alerts.bm_alert_days })}
              caption={alerts.bm_alert_days === 3 ? tc("common.default") : undefined}
              onDecrease={() => setAlerts((a) => ({ ...a, bm_alert_days: a.bm_alert_days === null || a.bm_alert_days <= 1 ? null : a.bm_alert_days - 1 }))}
              onIncrease={() => setAlerts((a) => ({ ...a, bm_alert_days: Math.min(14, (a.bm_alert_days ?? 0) + 1) }))}
              canDecrease={alerts.bm_alert_days !== null}
              decreaseLabel={t("fewerDays")}
              increaseLabel={t("moreDays")}
            />
          </Group>

          {(profile?.careStage === "baby" || profile?.toileting === "diapers") && (
            <Group label={t("wetMin")} hint={t("wetMinHint")}>
              <Stepper
                display={alerts.wet_diaper_min === null ? tc("common.off") : t("wetBy", { count: alerts.wet_diaper_min, time: formatHour(Number(wetBy.split(":")[0])) })}
                caption={t("wetAdvice")}
                onDecrease={() => setAlerts((a) => ({ ...a, wet_diaper_min: a.wet_diaper_min === null || a.wet_diaper_min <= 1 ? null : a.wet_diaper_min - 1 }))}
                onIncrease={() => setAlerts((a) => ({ ...a, wet_diaper_min: Math.min(20, (a.wet_diaper_min ?? 0) + 1) }))}
                canDecrease={alerts.wet_diaper_min !== null}
                decreaseLabel={t("fewerDiapers")}
                increaseLabel={t("moreDiapers")}
              />
              {alerts.wet_diaper_min !== null && (
                <RadioChips
                  label={t("byWhatTime")}
                  value={wetBy}
                  onChange={(v) => setAlerts((a) => ({ ...a, wet_diaper_by: v }))}
                  options={["12:00", "15:00", "18:00", "21:00"].map((hm) => ({ value: hm, label: t("byTime", { time: formatHour(Number(hm.split(":")[0])) }) }))}
                />
              )}
            </Group>
          )}

          <Group label={t("doseWindow")} hint={t("doseWindowHint")}>
            <Stepper
              display={t("windowValue", { count: alerts.med_dose_window_min })}
              onDecrease={() => setAlerts((a) => ({ ...a, med_dose_window_min: Math.max(15, a.med_dose_window_min - 15) }))}
              onIncrease={() => setAlerts((a) => ({ ...a, med_dose_window_min: Math.min(240, a.med_dose_window_min + 15) }))}
              decreaseLabel={t("shorterWindow")}
              increaseLabel={t("longerWindow")}
            />
          </Group>

          <Group label={t("dupWindow")} hint={t("dupWindowHint")}>
            <Stepper
              display={t("minutes", { count: alerts.med_duplicate_window_min })}
              onDecrease={() => setAlerts((a) => ({ ...a, med_duplicate_window_min: Math.max(15, a.med_duplicate_window_min - 15) }))}
              onIncrease={() => setAlerts((a) => ({ ...a, med_duplicate_window_min: Math.min(720, a.med_duplicate_window_min + 15) }))}
              decreaseLabel={t("shorterWindow")}
              increaseLabel={t("longerWindow")}
            />
          </Group>

          <button type="button" disabled={pending || !isAdmin} onClick={saveAlerts} className="w-full h-button rounded-full bg-primary text-primary-foreground text-body-lg disabled:opacity-60">
            {t("saveAlerts", { name: profile?.name ?? "" })}
          </button>
          {!isAdmin && <p className="text-caption text-muted-foreground">{t("adminOnlyAlerts")}</p>}
        </section>

        {message && <p role="status" className="text-label font-bold text-foreground-2 text-center">{message}</p>}
      </div>
    </>
  );
}
