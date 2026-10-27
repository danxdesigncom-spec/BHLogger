import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { TabBar } from "@/components/layout/TabBar";
import { ThemeProvider, type Theme, type ProfileColor } from "@/lib/theme-context";
import { HouseholdProvider, type ProfileSummary, type MemberSummary } from "@/lib/context/household-provider";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const theme = (cookieStore.get("bl-theme")?.value ?? "light") as Theme;
  const profileColor = (
    cookieStore.get("bl-profile-color")?.value ?? "violet"
  ) as ProfileColor;
  const activeProfileCookie = cookieStore.get("bl-active-profile")?.value ?? null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Check for household membership; new users are redirected to onboarding
  const { data: member } = await supabase
    .from("household_members")
    .select("id, household_id, role, display_name, initials, access_from")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!member) {
    redirect("/onboarding/profile");
  }

  // Load profiles accessible to this user
  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, name, color, care_stage")
    .eq("household_id", member.household_id)
    .is("archived_at", null)
    .order("created_at");

  const profiles: ProfileSummary[] = (profileRows ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color as ProfileColor,
    initials: p.name[0]?.toUpperCase() ?? "?",
    careStage: p.care_stage as "baby" | "child" | "teen_adult",
  }));

  // Load all members (display names only) for admin views
  const { data: memberRows } = await supabase
    .from("household_members")
    .select("id, user_id, role, display_name, initials, access_from")
    .eq("household_id", member.household_id);

  // Load profile access restrictions for each member
  const { data: accessRows } = await supabase
    .from("member_profile_access")
    .select("member_id, profile_id")
    .in("member_id", (memberRows ?? []).map((m) => m.id));

  const members: MemberSummary[] = (memberRows ?? []).map((m) => ({
    id: m.id,
    userId: m.user_id,
    displayName: m.display_name,
    initials: m.initials,
    role: m.role as "admin" | "caregiver" | "viewer",
    restrictedProfileIds: (accessRows ?? [])
      .filter((a) => a.member_id === m.id)
      .map((a) => a.profile_id),
    accessFrom: m.access_from,
  }));

  const currentMember = members.find((m) => m.userId === user.id) ?? {
    id: member.id,
    userId: user.id,
    displayName: member.display_name,
    initials: member.initials,
    role: member.role as "admin" | "caregiver" | "viewer",
    restrictedProfileIds: [],
    accessFrom: member.access_from,
  };

  // Resolve active profile: cookie value if valid, else first accessible profile
  const activeProfileId =
    activeProfileCookie && profiles.some((p) => p.id === activeProfileCookie)
      ? activeProfileCookie
      : (profiles[0]?.id ?? null);

  // Use the active profile's color if it differs from the cookie
  const resolvedColor = profiles.find((p) => p.id === activeProfileId)?.color ?? profileColor;

  return (
    <ThemeProvider initialTheme={theme} initialProfileColor={resolvedColor as ProfileColor}>
      <HouseholdProvider
        householdId={member.household_id}
        profiles={profiles}
        members={members}
        currentMember={currentMember}
        initialActiveProfileId={activeProfileId}
      >
        <main
          className="min-h-screen"
          style={{ paddingBottom: "calc(64px + max(12px, env(safe-area-inset-bottom, 0px)))" }}
        >
          {children}
        </main>
        <TabBar />
      </HouseholdProvider>
    </ThemeProvider>
  );
}
