import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
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
  const pref = cookieStore.get("bl-theme")?.value ?? DEFAULT_THEME;
  const theme = (["light", "dark", "night"].includes(pref) ? pref : "light") as Theme;
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
      {pref === "system" && (
        <head>
          <script
            dangerouslySetInnerHTML={{
              __html: `document.documentElement.dataset.theme=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"`,
            }}
          />
        </head>
      )}
      <body className="bg-background text-foreground font-sans antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
