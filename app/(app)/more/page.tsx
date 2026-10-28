"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, ChevronRight, Download, LogOut, Moon, Plus, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { AppHeader } from "@/components/layout/AppHeader";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useHousehold, type ProfileSummary } from "@/lib/context/household-provider";
import { usePendingCount, useProfileSettings } from "@/lib/data/hooks";
import { useTheme } from "@/lib/theme-context";
import { ageLabel, careStageLabel, roleLabel } from "@/lib/options";
import { signOut } from "@/lib/actions/auth";
import { exitDemoMode } from "@/app/auth/demo/actions";
import { updateProfile } from "@/lib/actions/settings";
import { clearDemoData } from "@/lib/data/demo-repo";
import { clearLocalData } from "@/lib/data/outbox";

function Row({ href, children, onClick }: { href?: string; children: React.ReactNode; onClick?: () => void }) {
  const cls = "w-full min-h-[60px] flex items-center gap-3 px-3.5 py-2 text-left";
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{children}</button>;
  return <div className={cls}>{children}</div>;
}

function Avatar({ profile }: { profile: ProfileSummary }) {
  return (
    <span aria-hidden="true" data-profile-color={profile.color} className="w-9 h-9 flex-none rounded-full bg-profile text-on-profile flex items-center justify-center font-display text-title-5">
      {profile.initials}
    </span>
  );
}

export default function MorePage() {
  const { mode, profiles, archivedProfiles, members, currentMember, householdSettings, activeProfileId, householdName } = useHousehold();
  const { theme } = useTheme();
  const settings = useProfileSettings(activeProfileId);
  const pending = usePendingCount();
  const router = useRouter();
  const t = useTranslations("more");
  const tc = useTranslations("common");
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [busy, startTransition] = useTransition();
  const isAdmin = currentMember.role === "admin";
  const others = members.filter((m) => m.id !== currentMember.id);

  const doSignOut = () =>
    startTransition(async () => {
      if (mode === "demo") {
        await clearDemoData();
        await exitDemoMode();
      } else {
        await clearLocalData();
        await signOut();
      }
    });

  const access = (restricted: string[]) =>
    restricted.length ? t("accessOnly", { names: restricted.map((id) => profiles.find((p) => p.id === id)?.name).filter(Boolean).join(", ") }) : t("accessAll");

  return (
    <>
      <AppHeader title={t("title")} />
      <div className="px-5 pt-2 pb-6 space-y-5">
        {householdName && <p className="-mt-2 text-label font-normal text-muted-foreground">{householdName}</p>}

        <section aria-labelledby="people-h" className="space-y-2">
          <h2 id="people-h" className="font-display text-title-5">{t("people")}</h2>
          <div className="rounded-card bg-card shadow-card divide-y divide-divider">
            {profiles.map((p) => (
              <Row key={p.id} href={`/more/profiles/${p.id}`}>
                <Avatar profile={p} />
                <span className="flex-1 min-w-0">
                  <span className="block text-body-md">{p.name}</span>
                  <span className="block text-caption text-muted-foreground">{[ageLabel(p.dob), careStageLabel(p.careStage)].filter(Boolean).join(" · ")}</span>
                </span>
                <ChevronRight size={20} strokeWidth={2} className="text-muted-foreground" aria-hidden="true" />
              </Row>
            ))}
            {isAdmin && (
              <Row href="/profiles/new">
                <span className="w-9 h-9 flex-none rounded-full border-[1.5px] border-dashed border-dashed-line flex items-center justify-center text-profile-ink">
                  <Plus size={18} strokeWidth={2} aria-hidden="true" />
                </span>
                <span className="text-body-md text-profile-ink">{t("addPerson")}</span>
              </Row>
            )}
          </div>
          {archivedProfiles.length > 0 && (
            <div className="rounded-card bg-card shadow-card divide-y divide-divider">
              {archivedProfiles.map((p) => (
                <div key={p.id} className="min-h-[60px] flex items-center gap-3 px-3.5 py-2">
                  <Avatar profile={p} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-body-md">{p.name}</span>
                    <span className="block text-caption text-muted-foreground">{t("archived")}</span>
                  </span>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => startTransition(async () => { await updateProfile(p.id, { archived: false }); router.refresh(); })}
                      className="min-h-touch-min px-4 rounded-full border-[1.5px] border-border-strong text-label font-extrabold"
                    >
                      {tc("restore")}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="care-h" className="space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="care-h" className="font-display text-title-5">{t("caregivers")}</h2>
            <span className="text-caption text-muted-foreground">{isAdmin ? t("youAdmin") : t("youRole", { role: roleLabel(currentMember.role).toLowerCase() })}</span>
          </div>
          <div className="rounded-card bg-card shadow-card divide-y divide-divider">
            {others.map((m) => (
              <Row key={m.id} href={isAdmin && mode === "live" ? `/more/caregivers/${m.id}` : undefined}>
                <span aria-hidden="true" className="w-9 h-9 flex-none rounded-full bg-secondary flex items-center justify-center text-body font-extrabold">{m.initials}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-body-md">{m.displayName}</span>
                  <span className="block text-caption text-muted-foreground">{t("memberLine", { role: roleLabel(m.role), access: access(m.restrictedProfileIds) })}</span>
                </span>
                {isAdmin && mode === "live" && <ChevronRight size={20} strokeWidth={2} className="text-muted-foreground" aria-hidden="true" />}
              </Row>
            ))}
            {isAdmin && (mode === "live" ? (
              <Row href="/more/caregivers/invite">
                <span className="w-9 h-9 flex-none rounded-full border-[1.5px] border-dashed border-dashed-line flex items-center justify-center text-profile-ink">
                  <UserPlus size={18} strokeWidth={2} aria-hidden="true" />
                </span>
                <span className="text-body-md text-profile-ink">{t("invite")}</span>
              </Row>
            ) : (
              <div className="px-3.5 py-3 text-caption text-muted-foreground">{t("inviteNeedsAccount")}</div>
            ))}
          </div>
        </section>

        <section aria-labelledby="settings-h" className="space-y-2">
          <h2 id="settings-h" className="font-display text-title-5">{t("settings")}</h2>
          <div className="rounded-card bg-card shadow-card divide-y divide-divider">
            <Row href="/more/settings/units">
              <Bell size={20} strokeWidth={2} className="flex-none text-profile" aria-hidden="true" />
              <span className="flex-1 text-body-md">{t("units")}</span>
              <span className="text-caption text-muted-foreground">
                {householdSettings.volume_unit} · {settings.bm_alert_days ? t("bmAlert", { days: settings.bm_alert_days }) : t("bmAlertOff")}
              </span>
              <ChevronRight size={20} strokeWidth={2} className="text-muted-foreground" aria-hidden="true" />
            </Row>
            <Row href="/more/settings/theme">
              <Moon size={20} strokeWidth={2} className="flex-none text-profile" aria-hidden="true" />
              <span className="flex-1 text-body-md">{t("theme")}</span>
              <span className="text-caption text-muted-foreground">{t("themeValue", { theme })}</span>
              <ChevronRight size={20} strokeWidth={2} className="text-muted-foreground" aria-hidden="true" />
            </Row>
            <Row href="/more/settings/data">
              <Download size={20} strokeWidth={2} className="flex-none text-profile" aria-hidden="true" />
              <span className="flex-1 text-body-md">{t("data")}</span>
              <ChevronRight size={20} strokeWidth={2} className="text-muted-foreground" aria-hidden="true" />
            </Row>
            <Row onClick={() => ((pending.data ?? 0) > 0 ? setConfirmSignOut(true) : doSignOut())}>
              <LogOut size={20} strokeWidth={2} className="flex-none text-destructive" aria-hidden="true" />
              <span className="flex-1 text-body-md text-destructive">{mode === "demo" ? t("exitDemo") : busy ? t("signingOut") : t("signOut")}</span>
            </Row>
          </div>
        </section>
      </div>

      {confirmSignOut && (
        <ConfirmDialog
          title={t("unsyncedTitle")}
          body={t("unsyncedBody", { count: pending.data ?? 0 })}
          cancelLabel={t("staySignedIn")}
          confirmLabel={t("signOutAnyway")}
          destructive
          onCancel={() => setConfirmSignOut(false)}
          onConfirm={() => { setConfirmSignOut(false); doSignOut(); }}
        />
      )}
    </>
  );
}
