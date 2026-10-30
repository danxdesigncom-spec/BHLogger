import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { TabBar } from "@/components/layout/TabBar";
import { ThemeProvider, type ProfileColor } from "@/lib/theme-context";
import { readThemeCookies } from "@/lib/theme-cookies";
import { HouseholdProvider, type MemberSummary, type ProfileSummary } from "@/lib/context/household-provider";
import { toProfileSummary } from "@/lib/profiles";
import { ReactQueryProvider } from "@/lib/query-client";
import { RepoProvider } from "@/lib/data/repo-context";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/app/auth/demo/actions";
import { DemoBanner } from "@/components/layout/DemoBanner";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import { demoHousehold, DEMO_HOUSEHOLD_ID } from "@/lib/demo/household";
import { readDemoOverrides } from "@/lib/demo/overrides";
import { getActiveMembership, getOtherHouseholds } from "@/lib/households/server";

function Shell({ demo, children }: { demo: boolean; children: React.ReactNode }) {
  return (
    <>
      {demo && <DemoBanner />}
      <OfflineBanner />
      <main
        className="min-h-screen lg:pl-[264px] print:pl-0"
        style={{ paddingBottom: "calc(var(--spacing-tabbar-clearance) + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mx-auto w-full max-w-[960px]">{children}</div>
      </main>
      <TabBar />
    </>
  );
}

function pickActive(profiles: ProfileSummary[], cookie: string | null) {
  return cookie && profiles.some((p) => p.id === cookie) ? cookie : (profiles[0]?.id ?? null);
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const { theme, night, nightNow } = await readThemeCookies();
  const profileColorCookie = (cookieStore.get("bl-profile-color")?.value ?? "violet") as ProfileColor;
  const activeProfileCookie = cookieStore.get("bl-active-profile")?.value ?? null;

  if (await isDemoMode()) {
    const demo = demoHousehold(await readDemoOverrides());
    const active = pickActive(demo.profiles, activeProfileCookie);
    const color = demo.profiles.find((p) => p.id === active)?.color ?? "violet";
    return (
      <ThemeProvider initialTheme={theme} initialNight={night} serverNight={nightNow} initialProfileColor={color as ProfileColor}>
        <HouseholdProvider
          mode="demo"
          householdId={DEMO_HOUSEHOLD_ID}
          householdName={demo.name}
          householdSettings={demo.settings}
          profiles={demo.profiles}
          archivedProfiles={demo.archivedProfiles}
          members={demo.members}
          currentMember={demo.currentMember}
          initialActiveProfileId={active}
        >
          <ReactQueryProvider>
            <RepoProvider>
              <Shell demo>{children}</Shell>
            </RepoProvider>
          </ReactQueryProvider>
        </HouseholdProvider>
      </ThemeProvider>
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // People can belong to more than one household; one is active on this device (lib/households).
  const { member, memberships } = await getActiveMembership(supabase, user.id);
  if (!member) redirect("/onboarding/profile");

  const [{ data: household }, { data: profileRows }, { data: memberRows }, otherHouseholds] = await Promise.all([
    supabase.from("households").select("name, settings").eq("id", member.household_id).maybeSingle(),
    supabase
      .from("profiles")
      .select("id, name, color, care_stage, dob, toileting, feeding_methods, enabled_modules, settings, care_card, archived_at")
      .eq("household_id", member.household_id)
      .order("created_at"),
    supabase.from("household_members").select("id, user_id, role, display_name, initials, access_from").eq("household_id", member.household_id),
    getOtherHouseholds(supabase, memberships.filter((m) => m.household_id !== member.household_id)),
  ]);

  const { data: accessRows } = await supabase
    .from("member_profile_access")
    .select("member_id, profile_id")
    .in("member_id", (memberRows ?? []).map((m) => m.id));

  const profiles = (profileRows ?? []).filter((p) => !p.archived_at).map(toProfileSummary);
  const archivedProfiles = (profileRows ?? []).filter((p) => p.archived_at).map(toProfileSummary);

  const members: MemberSummary[] = (memberRows ?? []).map((m) => ({
    id: m.id,
    userId: m.user_id,
    displayName: m.display_name,
    initials: m.initials,
    role: m.role as MemberSummary["role"],
    restrictedProfileIds: (accessRows ?? []).filter((a) => a.member_id === m.id).map((a) => a.profile_id),
    accessFrom: m.access_from,
  }));

  const currentMember = members.find((m) => m.userId === user.id) ?? {
    id: member.id,
    userId: user.id,
    displayName: member.display_name,
    initials: member.initials,
    role: member.role as MemberSummary["role"],
    restrictedProfileIds: [],
    accessFrom: member.access_from,
  };

  const active = pickActive(profiles, activeProfileCookie);
  const color = profiles.find((p) => p.id === active)?.color ?? profileColorCookie;

  return (
    <ThemeProvider initialTheme={theme} initialNight={night} serverNight={nightNow} initialProfileColor={color as ProfileColor}>
      <HouseholdProvider
        mode="live"
        householdId={member.household_id}
        householdName={household?.name ?? ""}
        householdSettings={household?.settings}
        profiles={profiles}
        archivedProfiles={archivedProfiles}
        members={members}
        currentMember={currentMember}
        initialActiveProfileId={active}
        otherHouseholds={otherHouseholds}
      >
        <ReactQueryProvider>
          <RepoProvider>
            <Shell demo={false}>{children}</Shell>
          </RepoProvider>
        </ReactQueryProvider>
      </HouseholdProvider>
    </ThemeProvider>
  );
}
