import { cookies } from "next/headers";
import { TabBar } from "@/components/layout/TabBar";
import { ThemeProvider, type Theme, type ProfileColor } from "@/lib/theme-context";

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

  return (
    <ThemeProvider initialTheme={theme} initialProfileColor={profileColor}>
      {/* Main content with bottom padding for the fixed tab bar */}
      <main
        className="min-h-screen"
        style={{ paddingBottom: "calc(64px + max(12px, env(safe-area-inset-bottom, 0px)))" }}
      >
        {children}
      </main>
      <TabBar />
    </ThemeProvider>
  );
}
