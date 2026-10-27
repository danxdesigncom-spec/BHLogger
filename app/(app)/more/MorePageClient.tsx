"use client";

import Link from "next/link";
import { ChevronRight, Plus, UserPlus, Bell, Moon, Download } from "lucide-react";
import type { ProfileColor } from "@/lib/supabase/types";

interface Profile {
  id: string;
  name: string;
  color: ProfileColor;
  careStage: "baby" | "child" | "teen_adult";
  dob: string | null;
}

interface Member {
  id: string;
  userId: string;
  displayName: string;
  initials: string;
  role: "admin" | "caregiver" | "viewer";
  restrictedProfileIds: string[];
}

interface Props {
  currentMemberId: string;
  currentRole: "admin" | "caregiver" | "viewer";
  profiles: Profile[];
  members: Member[];
  currentTheme: string;
}

const COLOR_CLASSES: Record<ProfileColor, string> = {
  violet: "bg-[var(--color-profile-violet)] text-white",
  teal:   "bg-[var(--color-profile-teal)] text-white",
  rose:   "bg-[var(--color-profile-rose)] text-white",
  amber:  "bg-[var(--color-profile-amber)] text-white",
  blue:   "bg-[var(--color-profile-blue)] text-white",
};

function stageDesc(m: Profile) {
  if (m.careStage === "baby") return "Baby";
  if (m.careStage === "child") {
    if (!m.dob) return "Child";
    const years = Math.floor(
      (Date.now() - new Date(m.dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25),
    );
    return `${years} year${years !== 1 ? "s" : ""} · Child`;
  }
  return "Teen or adult";
}

export function MorePageClient({
  currentMemberId,
  currentRole,
  profiles,
  members,
  currentTheme,
}: Props) {
  const isAdmin = currentRole === "admin";

  const otherMembers = members.filter((m) => m.id !== currentMemberId);

  return (
    <div className="px-5 pt-6 pb-8 space-y-5">
      <h1 className="font-display text-[30px] font-semibold leading-tight">More</h1>

      {/* People you care for */}
      <section aria-labelledby="people-h" className="space-y-2">
        <h2 id="people-h" className="font-display text-lg font-semibold">People you care for</h2>
        <div className="rounded-3xl bg-white shadow-sm overflow-hidden divide-y divide-[var(--color-border)]">
          {profiles.map((p) => (
            <Link
              key={p.id}
              href={`/profiles/${p.id}`}
              className="min-h-[60px] flex items-center gap-3 px-4 text-foreground no-underline"
            >
              <span
                className={`w-9 h-9 flex-none rounded-full flex items-center justify-center font-display text-[17px] font-semibold ${COLOR_CLASSES[p.color]}`}
              >
                {p.name[0].toUpperCase()}
              </span>
              <span className="flex-1 flex flex-col gap-[2px]">
                <span className="text-base font-extrabold">{p.name}</span>
                <span className="text-[13px] text-muted-foreground">{stageDesc(p)}</span>
              </span>
              <ChevronRight size={20} strokeWidth={2} className="text-muted-foreground" />
            </Link>
          ))}
          <Link
            href="/profiles/new"
            className="min-h-[60px] flex items-center gap-3 px-4 text-[var(--color-profile)] no-underline font-extrabold"
          >
            <span className="w-9 h-9 flex-none rounded-full border-[1.5px] border-dashed border-[var(--color-border)] flex items-center justify-center">
              <Plus size={18} strokeWidth={2} />
            </span>
            Add a person
          </Link>
        </div>
      </section>

      {/* Caregivers */}
      <section aria-labelledby="care-h" className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 id="care-h" className="font-display text-lg font-semibold">Caregivers</h2>
          {isAdmin && (
            <span className="text-[13px] text-muted-foreground">You&rsquo;re the admin</span>
          )}
        </div>
        <div className="rounded-3xl bg-white shadow-sm overflow-hidden divide-y divide-[var(--color-border)]">
          {otherMembers.map((m) => {
            const roleDesc =
              m.restrictedProfileIds.length > 0
                ? `${capitalize(m.role)} · restricted access`
                : `${capitalize(m.role)} · can log and edit own entries`;

            return (
              <Link
                key={m.id}
                href={isAdmin ? `/more/caregivers/${m.id}` : "#"}
                className="min-h-[60px] flex items-center gap-3 px-4 text-foreground no-underline"
                aria-disabled={!isAdmin}
              >
                <span className="w-9 h-9 flex-none rounded-full bg-[var(--color-surface-2)] text-foreground flex items-center justify-center text-[15px] font-extrabold">
                  {m.initials}
                </span>
                <span className="flex-1 flex flex-col gap-[2px]">
                  <span className="text-base font-extrabold">{m.displayName}</span>
                  <span className="text-[13px] text-muted-foreground">{roleDesc}</span>
                </span>
                {isAdmin && (
                  <ChevronRight size={20} strokeWidth={2} className="text-muted-foreground" />
                )}
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              href="/more/caregivers/invite"
              className="min-h-[60px] flex items-center gap-3 px-4 text-[var(--color-profile)] no-underline font-extrabold"
            >
              <span className="w-9 h-9 flex-none rounded-full border-[1.5px] border-dashed border-[var(--color-border)] flex items-center justify-center">
                <UserPlus size={18} strokeWidth={2} />
              </span>
              Invite a caregiver
            </Link>
          )}
        </div>
      </section>

      {/* Settings */}
      <section aria-labelledby="settings-h" className="space-y-2">
        <h2 id="settings-h" className="font-display text-lg font-semibold">Settings</h2>
        <div className="rounded-3xl bg-white shadow-sm overflow-hidden divide-y divide-[var(--color-border)]">
          <Link
            href="/settings/units"
            className="min-h-[56px] flex items-center gap-3 px-4 text-foreground no-underline"
          >
            <Bell size={20} strokeWidth={2} className="text-[var(--color-profile)] flex-none" />
            <span className="flex-1 text-base font-extrabold">Units and alerts</span>
            <span className="text-[13px] text-muted-foreground mr-1">oz · BM alert 3 days</span>
            <ChevronRight size={20} strokeWidth={2} className="text-muted-foreground" />
          </Link>
          <Link
            href="/settings/theme"
            className="min-h-[56px] flex items-center gap-3 px-4 text-foreground no-underline"
          >
            <Moon size={20} strokeWidth={2} className="text-[var(--color-profile)] flex-none" />
            <span className="flex-1 text-base font-extrabold">Theme and night mode</span>
            <span className="text-[13px] text-muted-foreground mr-1">
              {currentTheme === "light" ? "Light" : currentTheme === "dark" ? "Dark" : "Automatic"}
            </span>
            <ChevronRight size={20} strokeWidth={2} className="text-muted-foreground" />
          </Link>
          <Link
            href="/settings/export"
            className="min-h-[56px] flex items-center gap-3 px-4 text-foreground no-underline"
          >
            <Download size={20} strokeWidth={2} className="text-[var(--color-profile)] flex-none" />
            <span className="flex-1 text-base font-extrabold">Export or delete data</span>
            <ChevronRight size={20} strokeWidth={2} className="text-muted-foreground" />
          </Link>
        </div>
      </section>
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
