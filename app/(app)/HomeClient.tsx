"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight, Droplet, Moon } from "lucide-react";
import { useTranslations } from "next-intl";
import { ProfileSwitcherSheet } from "@/components/profile/ProfileSwitcherSheet";
import { LogSheet, MODULE_ICONS, type ModuleType } from "@/components/log/LogSheet";
import { ModuleTile } from "@/components/log/ModuleTile";
import { useUndoToast } from "@/components/log/useUndoToast";
import { BathroomSheet } from "@/components/log/modules/BathroomSheet";
import { EatingSheet } from "@/components/log/modules/EatingSheet";
import { ActivitySheet } from "@/components/log/modules/ActivitySheet";
import { MoodSheet } from "@/components/log/modules/MoodSheet";
import { Banners, type BannerItem } from "@/components/home/Banners";
import { InstallPrompt } from "@/components/home/InstallPrompt";
import { QuickTaps } from "@/components/home/QuickTaps";
import { RunningTimers } from "@/components/home/RunningTimers";
import { useQuickLog } from "@/components/log/useQuickLog";
import { useHousehold } from "@/lib/context/household-provider";
import { useEntries, useLatestEntry, useMedications, useProfileSettings } from "@/lib/data/hooks";
import { entryShortLabel, formatAgo, formatClock, tileStatus, type SummaryContext } from "@/lib/entries/summary";
import { bathroomTileLabel, formatDose } from "@/lib/options";
import { todaySlots } from "@/lib/meds/schedule";
import { bmAlert } from "@/lib/home/alerts";
import { startOfDay } from "@/lib/dates";
import { orderTiles, wideTiles } from "@/lib/home/tiles";

const LOG_PARAM: Record<string, ModuleType> = {
  bathroom: "bathroom", diaper: "bathroom", eating: "eating", feeding: "eating", activity: "activity", mood: "mood",
};

export function HomeClient() {
  const { profiles, activeProfile, activeProfileId, setActiveProfile, householdSettings, currentMember } = useHousehold();
  const t = useTranslations();
  const h = (k: string, v?: Record<string, string | number>) => t(`home.${k}`, v);
  const router = useRouter();
  const params = useSearchParams();
  const openSheet = LOG_PARAM[params.get("log") ?? ""] ?? null;
  const setOpenSheet = (m: ModuleType | null) => router.replace(m ? `/?log=${m}` : "/", { scroll: false });

  const [switcherOpen, setSwitcherOpen] = useState(false);
  const { showToast, toastElement } = useUndoToast();
  const quick = useQuickLog(showToast);
  const settings = useProfileSettings(activeProfileId);

  const stage = activeProfile?.careStage ?? "child";
  const toileting = activeProfile?.toileting ?? "toilet";
  const isBaby = stage === "baby";
  const enabled = new Set(activeProfile?.enabledModules ?? []);
  const other = profiles.find((p) => p.id !== activeProfileId);

  const bathroom = useLatestEntry(activeProfileId, "bathroom");
  const eating = useLatestEntry(activeProfileId, "eating");
  const mood = useLatestEntry(activeProfileId, "mood");
  const activity = useLatestEntry(activeProfileId, "activity");
  const lastBm = useLatestEntry(activeProfileId, "bathroom", { kind: "bm" });
  const lastBoth = useLatestEntry(activeProfileId, "bathroom", { kind: "both" });
  const meds = useMedications(activeProfileId);
  const todayStart = useMemo(() => startOfDay(new Date()).toISOString(), []);
  const todayDoses = useEntries({ profileId: activeProfileId ?? undefined, types: ["medication"], from: todayStart }, !!activeProfileId);
  const wetMin = settings.wet_diaper_min;
  const todayBathroom = useEntries({ profileId: activeProfileId ?? undefined, types: ["bathroom"], from: todayStart }, !!activeProfileId && wetMin !== null);

  const medName = (id: string) => meds.data?.find((m) => m.id === id)?.name;
  const ctx: SummaryContext = { careStage: stage, toileting, volumeUnit: householdSettings.volume_unit, medicationName: medName };

  const now = new Date();
  const lastBmIso = [lastBm.data?.occurred_at, lastBoth.data?.occurred_at].filter(Boolean).sort().at(-1) ?? null;
  const bm = bmAlert(lastBmIso, settings.bm_alert_days, now);

  // ─── Medications: today's slots across active scheduled meds ──────────────
  const slots = (meds.data ?? [])
    .filter((m) => m.active && m.kind === "scheduled")
    .flatMap((m) => todaySlots(m, todayDoses.data ?? [], now).map((s) => ({ med: m, ...s })));
  const givenCount = slots.filter((s) => s.state === "given").length;
  const notLogged = slots.filter((s) => s.state === "not_logged");
  const nextSlot = slots.filter((s) => s.state === "due" || s.state === "upcoming").sort((a, b) => a.slot.getTime() - b.slot.getTime())[0];
  const medStatus = !meds.isFetched || !todayDoses.isFetched
    ? ""
    : !meds.data?.some((m) => m.active)
    ? h("noMeds")
    : slots.length
      ? notLogged.length
        ? h("notLogged", { count: notLogged.length })
        : h("givenToday", { given: givenCount, total: slots.length })
      : h("asNeededOnly");

  // ─── Banners (QL-08) ─────────────────────────────────────────────────────
  const banners: BannerItem[] = [];
  for (const s of notLogged) {
    banners.push({
      key: `med-${s.med.id}-${s.slot.toISOString()}`, priority: 0, tone: "warning",
      icon: <span className="[&_svg]:w-6 [&_svg]:h-6">{MODULE_ICONS.medication}</span>,
      title: h("medNotLogged", { name: s.med.name }), sub: h("wasDue", { time: formatClock(s.slot.toISOString()), dose: formatDose(Number(s.med.default_dose), s.med.dose_unit) }),
      action: { label: h("give"), href: `/meds?give=${s.med.id}` },
    });
  }
  if (bm.alert && enabled.has("bathroom")) {
    banners.push({
      key: `bm-${activeProfileId}-${lastBmIso ?? "none"}`, priority: 1, tone: "warning",
      icon: <Droplet size={24} strokeWidth={2} aria-hidden="true" />,
      title: h("bmDays", { days: bm.days ?? 0, name: activeProfile?.name ?? "" }), sub: h("alertSet", { days: settings.bm_alert_days ?? 0 }),
      action: { label: h("logBm"), onClick: () => setOpenSheet("bathroom") },
    });
  }
  // BTH-09: fewer wet diapers than the caregiver's minimum by the chosen time.
  const wetBy = (settings as { wet_diaper_by?: string }).wet_diaper_by ?? "18:00";
  const [wetH, wetM] = wetBy.split(":").map(Number);
  const wetDeadline = new Date(now);
  wetDeadline.setHours(wetH, wetM, 0, 0);
  const wetToday = (todayBathroom.data ?? []).filter((e) => ["pee", "both"].includes(String((e.data as { kind?: string }).kind))).length;
  if (wetMin !== null && todayBathroom.isFetched && now >= wetDeadline && wetToday < wetMin && enabled.has("bathroom")) {
    banners.push({
      key: `wet-${activeProfileId}-${todayStart}`, priority: 1, tone: "warning",
      icon: <Droplet size={24} strokeWidth={2} aria-hidden="true" />,
      title: h("fewerWet", { min: wetMin, time: formatClock(wetDeadline.toISOString()) }),
      sub: h("wetSoFar", { count: wetToday }),
      action: { label: h("logDiaper"), onClick: () => setOpenSheet("bathroom") },
    });
  }
  if (nextSlot && nextSlot.slot.getTime() - now.getTime() < 2 * 3_600_000) {
    const mins = Math.round((nextSlot.slot.getTime() - now.getTime()) / 60_000);
    banners.push({
      key: `due-${nextSlot.med.id}-${nextSlot.slot.toISOString()}`, priority: 2, tone: "amber",
      icon: <Moon size={24} strokeWidth={2} aria-hidden="true" />,
      title: h("medAt", { name: nextSlot.med.name, time: formatClock(nextSlot.slot.toISOString()) }),
      sub: (() => {
        const dose = formatDose(Number(nextSlot.med.default_dose), nextSlot.med.dose_unit);
        return mins > 0 ? h("inMinutes", { count: mins, dose }) : h("dueNow", { dose });
      })(),
      action: { label: h("give"), href: `/meds?give=${nextSlot.med.id}` },
    });
  }
  if (isBaby && eating.data && enabled.has("eating")) {
    banners.push({
      key: `fed-${eating.data.id}`, priority: 3, tone: "profile",
      icon: <span className="[&_svg]:w-6 [&_svg]:h-6">{MODULE_ICONS.eating}</span>,
      title: h("lastFed", { ago: formatAgo(eating.data.occurred_at, now) }),
      sub: h("lastFedSub", { label: entryShortLabel(eating.data, ctx), time: formatClock(eating.data.occurred_at) }),
      action: { label: h("logFeed"), onClick: () => setOpenSheet("eating") },
    });
  }

  const nothingYet = [bathroom, eating, mood, activity].every((q) => q.isFetched && !q.data);
  const canLog = currentMember.role !== "viewer";
  const tileLabels: Record<ModuleType, string> = {
    bathroom: bathroomTileLabel(stage, toileting),
    eating: isBaby ? t("modules.feeding") : t("modules.eating"),
    mood: t("modules.mood"),
    activity: t("modules.activity"),
    medication: t("modules.medication"),
  };

  const tiles = orderTiles(settings.tile_order).filter((m) => enabled.has(m));
  const wide = wideTiles(tiles);
  const latest = { eating, mood, activity };

  return (
    <>
      <header className="flex items-center justify-between gap-3 px-5 pt-[18px] pb-1">
        <button
          type="button"
          aria-label={t("common.switchProfile", { name: activeProfile?.name ?? "" })}
          onClick={() => setSwitcherOpen(true)}
          className="min-h-touch flex items-center gap-2 py-1.5 pl-1.5 pr-3.5 rounded-full bg-card shadow-raised"
        >
          <span aria-hidden="true" data-profile-color={activeProfile?.color} data-initial={activeProfile?.initials} className="w-9 h-9 rounded-full bg-profile text-on-profile flex items-center justify-center font-display text-title-5 before:content-[attr(data-initial)]" />
          <span className="text-body-lg">{activeProfile?.name}</span>
          <ChevronDown size={18} strokeWidth={2} aria-hidden="true" />
        </button>
        {other && (
          <button
            type="button"
            aria-label={h("switchTo", { name: other.name })}
            onClick={() => setActiveProfile(other.id)}
            data-profile-color={other.color}
            className="w-12 h-12 rounded-full border-[3px] border-card bg-profile text-on-profile shadow-raised flex items-center justify-center font-display text-title-5"
          >
            {other.initials}
          </button>
        )}
      </header>

      <div className="px-5 pt-3.5 pb-4 space-y-4">
        <h1 className="font-display text-display-1">{h("greeting", { name: activeProfile?.name ?? h("everyone") })}</h1>

        {canLog && <RunningTimers onStop={quick.save} />}
        {canLog && <Banners items={banners} />}
        <InstallPrompt />

        {nothingYet && (
          <div className="rounded-card bg-card p-4 shadow-card space-y-1.5">
            <p className="text-body-md">{t("common.nothingLoggedYet")}</p>
            <ul className="text-caption text-muted-foreground space-y-1">
              <li>{h("tipTap")}</li>
              <li>{h("tipSync")}</li>
              <li>{h("tipUndo")}</li>
            </ul>
          </div>
        )}

        <nav aria-label={h("logFor", { name: activeProfile?.name ?? "" })} className="grid grid-cols-2 gap-3">
          {tiles.map((m) => m === "bathroom" ? (
            <ModuleTile
              key={m}
              module="bathroom"
              label={tileLabels.bathroom}
              icon={<Droplet size={22} strokeWidth={2} aria-hidden="true" />}
              status={bathroom.isFetched ? tileStatus(bathroom.data, ctx, now) : null}
              alertPill={bm.alert ? bm.label : null}
              wide={wide.has(m)}
              onClick={() => canLog && setOpenSheet("bathroom")}
            />
          ) : m !== "medication" ? (
            <ModuleTile key={m} module={m} label={tileLabels[m]} icon={MODULE_ICONS[m]} status={latest[m].isFetched ? tileStatus(latest[m].data, ctx, now) : null} wide={wide.has(m)} onClick={() => canLog && setOpenSheet(m)} />
          ) : (
            <Link
              key={m}
              href="/meds"
              className="col-span-2 flex items-center gap-3.5 min-h-20 p-4 rounded-tile bg-medication text-foreground"
            >
              <span className="w-11 h-11 flex-none rounded-full bg-card text-medication-ink flex items-center justify-center [&_svg]:w-[22px] [&_svg]:h-[22px]">
                {MODULE_ICONS.medication}
              </span>
              <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="font-display text-title-3">{tileLabels.medication}</span>{" "}
                <span className={notLogged.length ? "self-start px-2.5 py-0.5 rounded-full bg-card text-caption font-extrabold text-warning-ink" : "text-label font-bold text-foreground-2"}>
                  {medStatus}
                </span>
              </span>
              <ChevronRight size={22} strokeWidth={2} aria-hidden="true" />
            </Link>
          ))}
        </nav>

        {canLog && activeProfileId && (
          <QuickTaps profileId={activeProfileId} onTap={(tpl, label) => quick.logTemplate(activeProfileId, tpl, label)} />
        )}
      </div>

      <ProfileSwitcherSheet open={switcherOpen} onClose={() => setSwitcherOpen(false)} />

      <LogSheet module="bathroom" moduleLabel={tileLabels.bathroom} detailsHint={toileting === "diapers" ? h("hintDiaper") : h("hintToilet")} open={openSheet === "bathroom"} onClose={() => setOpenSheet(null)} onSaved={showToast}>
        {(c) => <BathroomSheet ctx={c} />}
      </LogSheet>
      <LogSheet module="eating" moduleLabel={tileLabels.eating} detailsHint={isBaby ? h("hintFeeding") : h("hintEating")} open={openSheet === "eating"} onClose={() => setOpenSheet(null)} onSaved={showToast}>
        {(c) => <EatingSheet ctx={c} />}
      </LogSheet>
      <LogSheet module="activity" moduleLabel={tileLabels.activity} open={openSheet === "activity"} onClose={() => setOpenSheet(null)} onSaved={showToast}>
        {(c) => <ActivitySheet ctx={c} />}
      </LogSheet>
      <LogSheet module="mood" moduleLabel={tileLabels.mood} detailsHint={h("hintMood")} open={openSheet === "mood"} onClose={() => setOpenSheet(null)} onSaved={showToast}>
        {(c) => <MoodSheet ctx={c} />}
      </LogSheet>

      {quick.dialog}
      {toastElement}
    </>
  );
}
