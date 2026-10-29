"use client";

import { createContext, useContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { isNight, NIGHT_COOKIE, parseNight, readCookie, serializeNight, setNightSchedule, turnNight, type NightPrefs } from "@/lib/night";
import { parseThemePreference, type ProfileColor, type Theme, type ThemePreference } from "@/lib/theme";

export type { ProfileColor, Theme, ThemePreference } from "@/lib/theme";

interface ThemeContextValue {
  theme: ThemePreference;
  setTheme: (t: ThemePreference) => void;
  /** Night mode is showing right now. */
  night: boolean;
  nightPrefs: NightPrefs;
  /** The night switch and the Home moon button. */
  setNight: (on: boolean) => void;
  setNightHours: (patch: Partial<Pick<NightPrefs, "auto" | "from" | "to">>) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const YEAR = 60 * 60 * 24 * 365;
/** How often an open app re-checks the night window. */
const CHECK_MS = 30_000;

export function resolveTheme(pref: ThemePreference): Theme {
  if (pref !== "system") return pref;
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const saveCookie = (name: string, value: string) => {
  document.cookie = `${name}=${value}; path=/; max-age=${YEAR}; SameSite=Lax`;
};

export function ThemeProvider({
  children,
  initialTheme,
  initialNight,
  serverNight = false,
}: {
  children: ReactNode;
  initialTheme: ThemePreference;
  initialNight: NightPrefs;
  /** What the server rendered: night only when it was turned on by hand. The clock check follows on mount. */
  serverNight?: boolean;
  initialProfileColor?: ProfileColor;
}) {
  const [theme, setThemeState] = useState<ThemePreference>(initialTheme);
  const [nightPrefs, setNightPrefs] = useState<NightPrefs>(initialNight);
  const [night, setNightNow] = useState(serverNight);
  const pathname = usePathname();

  // A page the service worker cached earlier carries old values, so this device's cookies win.
  useEffect(() => {
    const night = readCookie(NIGHT_COOKIE);
    if (night && night !== serializeNight(initialNight)) setNightPrefs(parseNight(night));
    const pref = readCookie("bl-theme");
    if (pref && parseThemePreference(pref) !== initialTheme) setThemeState(parseThemePreference(pref));
  }, [initialNight, initialTheme]);

  // The automatic window depends on this device's clock, so it's checked here rather than on the server.
  useEffect(() => {
    const check = () => setNightNow(isNight(nightPrefs, new Date()));
    check();
    const id = window.setInterval(check, CHECK_MS);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", check);
    };
  }, [nightPrefs]);

  // data-theme on <html>, and the browser and status bar color to match, so night mode has no bright strip.
  useEffect(() => {
    const apply = () => {
      const root = document.documentElement;
      root.setAttribute("data-theme", night ? "night" : resolveTheme(theme));
      const bg = getComputedStyle(root).getPropertyValue("--background").trim();
      if (bg) document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", bg));
    };
    apply();
    if (theme !== "system" || night) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme, night, pathname]);

  const setTheme = useCallback((t: ThemePreference) => {
    setThemeState(t);
    saveCookie("bl-theme", t);
  }, []);

  const saveNight = useCallback(
    (update: (n: NightPrefs, now: Date) => NightPrefs) => {
      const now = new Date();
      const next = update(nightPrefs, now);
      saveCookie(NIGHT_COOKIE, serializeNight(next));
      setNightPrefs(next);
      setNightNow(isNight(next, now));
    },
    [nightPrefs],
  );

  const setNight = useCallback((on: boolean) => saveNight((n, now) => turnNight(n, on, now)), [saveNight]);
  const setNightHours = useCallback(
    (patch: Partial<Pick<NightPrefs, "auto" | "from" | "to">>) => saveNight((n, now) => setNightSchedule(n, patch, now)),
    [saveNight],
  );

  const value = useMemo(
    () => ({ theme, setTheme, night, nightPrefs, setNight, setNightHours }),
    [theme, setTheme, night, nightPrefs, setNight, setNightHours],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
