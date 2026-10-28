import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { TabBar } from "@/components/layout/TabBar";
import { ThemeProvider, type Theme, type ProfileColor } from "@/lib/theme-context";
import { HouseholdProvider, type MemberSummary, type ProfileSummary } from "@/lib/context/household-provider";
import { toProfileSummary } from "@/lib/profiles";
import { ReactQueryProvider } from "@/lib/query-client";
import { RepoProvider } from "@/lib/data/repo-context";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/app/auth/demo/actions";
import { DemoBanner } from "@/components/layout/DemoBanner";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import { demoHousehold, DEMO_HOUSEHOLD_ID } from "@/lib/demo/household";

function Shell({ demo, children }: { demo: boolean; children: React.ReactNode }) {
  return (
    <>
      {demo && <DemoBanner />}
      <OfflineBanner />
      <main
        className="min-h-screen lg:pl-[264px]"
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
  const theme = (cookieStore.get("bl-theme")?.value ?? "light") as Theme;
  const profileColorCookie = (cookieStore.get("bl-profile-color")?.value ?? "violet") as ProfileColor;
  const activeProfileCookie = cookieStore.get("bl-active-profile")?.value ?? null;

  if (await isDemoMode()) {
    const demo = demoHousehold();
    const active = pickActive(demo.profiles, activeProfileCookie);
    const color = demo.profiles.find((p) => p.id === active)?.color ?? "violet";
    return (
      <ThemeProvider initialTheme={theme} initialProfileColor={color as ProfileColor}>
        <HouseholdProvider
          mode="demo"
          householdId={DEMO_HOUSEHOLD_ID}
          householdName={demo.name}
          householdSettings={demo.settings}
          profiles={demo.profiles}
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

  const { data: member } = await supabase
    .from("household_members")
    .select("id, household_id, role, display_name, initials, access_from")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!member) redirect("/onboarding/profile");

  const [{ data: household }, { data: profileRows }, { data: memberRows }] = await Promise.all([
    supabase.from("households").select("name, settings").eq("id", member.household_id).maybeSingle(),
    supabase
      .from("profiles")
      .select("id, name, color, care_stage, dob, toileting, feeding_methods, enabled_modules, settings, care_card")
      .eq("household_id", member.household_id)
      .is("archived_at", null)
      .order("created_at"),
    supabase.from("household_members").select("id, user_id, role, display_name, initials, access_from").eq("household_id", member.household_id),
  ]);

  const { data: accessRows } = await supabase
    .from("member_profile_access")
    .select("member_id, profile_id")
    .in("member_id", (memberRows ?? []).map((m) => m.id));

  const profiles = (profileRows ?? []).map(toProfileSummary);

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
    <ThemeProvider initialTheme={theme} initialProfileColor={color as ProfileColor}>
      <HouseholdProvider
        mode="live"
        householdId={member.household_id}
        householdName={household?.name ?? ""}
        householdSettings={household?.settings}
        profiles={profiles}
        members={members}
        currentMember={currentMember}
        initialActiveProfileId={active}
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
