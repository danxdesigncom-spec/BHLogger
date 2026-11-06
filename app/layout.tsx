import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import tokens from "@/design/tokens.json";
import { themeScript } from "@/lib/night";
import { readThemeCookies } from "@/lib/theme-cookies";
import type { ProfileColor, Theme } from "@/lib/theme";
import "./globals.css";

// Self-hosted (latin subset, from Fontsource; SIL OFL, licenses in app/fonts). next/font/google in
// Next 15.3 can't parse Google Fonts' current file URLs, which broke builds on Vercel.
const fredoka = localFont({
  src: [
    { path: "./fonts/fredoka-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/fredoka-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-fredoka",
  display: "swap",
});

const nunito = localFont({
  src: [
    { path: "./fonts/nunito-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/nunito-latin-700-normal.woff2", weight: "700", style: "normal" },
    { path: "./fonts/nunito-latin-800-normal.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-nunito",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return {
    title: {
      template: t("titleTemplate"),
      default: t("name"),
    },
    description: t("description"),
    manifest: "/manifest.webmanifest",
    icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: t("name"),
    },
  };
}

const bar = (theme: Theme) => tokens.color[theme].background;

/** The browser and status bar color follows the device's theme; ThemeProvider updates it when night mode turns on. */
export async function generateViewport(): Promise<Viewport> {
  const { theme, nightNow } = await readThemeCookies();
  return {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    themeColor: nightNow
      ? bar("night")
      : theme === "system"
        ? [
            { media: "(prefers-color-scheme: light)", color: bar("light") },
            { media: "(prefers-color-scheme: dark)", color: bar("dark") },
          ]
        : bar(theme),
  };
}

const DEFAULT_PROFILE_COLOR: ProfileColor = "violet";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const { theme: pref, night, nightNow } = await readThemeCookies();
  // The server can't know the device's time zone, so the head script settles "system" and automatic night hours.
  const theme: Theme = nightNow ? "night" : pref === "system" ? "light" : pref;
  const profileColor = (
    cookieStore.get("bl-profile-color")?.value ?? DEFAULT_PROFILE_COLOR
  ) as ProfileColor;

  return (
    <html
      lang={await getLocale()}
      data-theme={theme}
      data-profile-color={profileColor}
      className={`${fredoka.variable} ${nunito.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript(pref, night) }} />
      </head>
      <body className="bg-background text-foreground font-sans antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
