import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";

const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-fredoka",
  display: "swap",
});

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "700", "800"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    template: "%s · Behavior Logger",
    default: "Behavior Logger",
  },
  description: "Log bathroom, eating, activities, mood and medications in three taps or fewer.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Behavior Logger",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F1FC" },
    { media: "(prefers-color-scheme: dark)",  color: "#13101E" },
  ],
};

type Theme = "light" | "dark" | "night";
type ProfileColor = "violet" | "teal" | "rose" | "amber" | "blue";

const DEFAULT_THEME: Theme = "light";
const DEFAULT_PROFILE_COLOR: ProfileColor = "violet";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const theme = (cookieStore.get("bl-theme")?.value ?? DEFAULT_THEME) as Theme;
  const profileColor = (
    cookieStore.get("bl-profile-color")?.value ?? DEFAULT_PROFILE_COLOR
  ) as ProfileColor;

  return (
    <html
      lang="en"
      data-theme={theme}
      data-profile-color={profileColor}
      className={`${fredoka.variable} ${nunito.variable}`}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
