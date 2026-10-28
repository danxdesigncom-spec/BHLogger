"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
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
      setMessage("error" in r ? r.error : "Saved");
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
      setMessage("error" in r ? r.error : `Alerts saved for ${profile?.name}`);
      await qc.invalidateQueries({ queryKey: ["profile-settings"] });
      router.refresh();
    });

  return (
    <>
      <PageHeader title="Units and alerts" backHref="/more" backLabel="Back to More" showDot={false} />
      <div className="px-5 pt-3 pb-8 space-y-6">
        <section aria-labelledby="units-h" className="space-y-4">
          <h2 id="units-h" className="font-display text-title-5">Units and formats</h2>
          {!isAdmin && <p className="text-caption text-muted-foreground">Only an admin can change these for the household.</p>}
          <fieldset disabled={!isAdmin || pending} className="space-y-4 disabled:opacity-60">
            <Group label="Volume">
              <Segmented label="Volume" value={householdSettings.volume_unit} onChange={(v) => setHousehold({ volume_unit: v })} options={[{ value: "oz", label: "oz" }, { value: "ml", label: "ml" }]} />
            </Group>
            <Group label="Time">
              <Segmented label="Time format" value={householdSettings.time_format} onChange={(v) => setHousehold({ time_format: v })} options={[{ value: "12h", label: "12-hour" }, { value: "24h", label: "24-hour" }]} />
            </Group>
            <Group label="Weeks start on">
              <Segmented label="Week starts on" value={householdSettings.week_start} onChange={(v) => setHousehold({ week_start: v })} options={[{ value: "sunday", label: "Sunday" }, { value: "monday", label: "Monday" }]} />
            </Group>
          </fieldset>
        </section>

        <section aria-labelledby="alerts-h" className="space-y-4">
          <h2 id="alerts-h" className="font-display text-title-5">Alerts</h2>
          <RadioChips label="Profile" value={profileId} onChange={setProfileId} options={profiles.map((p) => ({ value: p.id, label: p.name }))} />

          <Group label="Days without a BM" hint="Home banner and Today card">
            <Stepper
              display={alerts.bm_alert_days === null ? "Off" : `${alerts.bm_alert_days} day${alerts.bm_alert_days === 1 ? "" : "s"}`}
              caption={alerts.bm_alert_days === 3 ? "Default" : undefined}
              onDecrease={() => setAlerts((a) => ({ ...a, bm_alert_days: a.bm_alert_days === null || a.bm_alert_days <= 1 ? null : a.bm_alert_days - 1 }))}
              onIncrease={() => setAlerts((a) => ({ ...a, bm_alert_days: Math.min(14, (a.bm_alert_days ?? 0) + 1) }))}
              canDecrease={alerts.bm_alert_days !== null}
              decreaseLabel="Fewer days"
              increaseLabel="More days"
            />
          </Group>

          {(profile?.careStage === "baby" || profile?.toileting === "diapers") && (
            <Group label="Wet-diaper minimum" hint="Off by default">
              <Stepper
                display={alerts.wet_diaper_min === null ? "Off" : `${alerts.wet_diaper_min} by ${formatHour(Number(wetBy.split(":")[0]))}`}
                caption="Set this on your pediatrician's advice"
                onDecrease={() => setAlerts((a) => ({ ...a, wet_diaper_min: a.wet_diaper_min === null || a.wet_diaper_min <= 1 ? null : a.wet_diaper_min - 1 }))}
                onIncrease={() => setAlerts((a) => ({ ...a, wet_diaper_min: Math.min(20, (a.wet_diaper_min ?? 0) + 1) }))}
                canDecrease={alerts.wet_diaper_min !== null}
                decreaseLabel="Fewer diapers"
                increaseLabel="More diapers"
              />
              {alerts.wet_diaper_min !== null && (
                <RadioChips
                  label="By what time"
                  value={wetBy}
                  onChange={(v) => setAlerts((a) => ({ ...a, wet_diaper_by: v }))}
                  options={["12:00", "15:00", "18:00", "21:00"].map((t) => ({ value: t, label: `By ${formatHour(Number(t.split(":")[0]))}` }))}
                />
              )}
            </Group>
          )}

          <Group label="Dose window" hint="Counts as on time">
            <Stepper
              display={`±${alerts.med_dose_window_min} min`}
              onDecrease={() => setAlerts((a) => ({ ...a, med_dose_window_min: Math.max(15, a.med_dose_window_min - 15) }))}
              onIncrease={() => setAlerts((a) => ({ ...a, med_dose_window_min: Math.min(240, a.med_dose_window_min + 15) }))}
              decreaseLabel="Shorter window"
              increaseLabel="Longer window"
            />
          </Group>

          <Group label="Duplicate-dose window" hint="For medications without a minimum interval">
            <Stepper
              display={`${alerts.med_duplicate_window_min} min`}
              onDecrease={() => setAlerts((a) => ({ ...a, med_duplicate_window_min: Math.max(15, a.med_duplicate_window_min - 15) }))}
              onIncrease={() => setAlerts((a) => ({ ...a, med_duplicate_window_min: Math.min(720, a.med_duplicate_window_min + 15) }))}
              decreaseLabel="Shorter window"
              increaseLabel="Longer window"
            />
          </Group>

          <button type="button" disabled={pending || !isAdmin} onClick={saveAlerts} className="w-full h-button rounded-full bg-primary text-primary-foreground text-body-lg disabled:opacity-60">
            Save alerts for {profile?.name}
          </button>
          {!isAdmin && <p className="text-caption text-muted-foreground">Only an admin can change alert settings.</p>}
        </section>

        {message && <p role="status" className="text-label font-bold text-foreground-2 text-center">{message}</p>}
      </div>
    </>
  );
}
