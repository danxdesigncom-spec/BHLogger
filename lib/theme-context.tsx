"use client";

import { createContext, useContext, useCallback, useState, type ReactNode } from "react";

export type Theme = "light" | "dark" | "night";
export type ThemePreference = Theme | "system";
export type ProfileColor = "violet" | "teal" | "rose" | "amber" | "blue";

interface ThemeContextValue {
  theme: ThemePreference;
  setTheme: (t: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const YEAR = 60 * 60 * 24 * 365;

export function resolveTheme(pref: ThemePreference): Theme {
  if (pref !== "system") return pref;
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({
  children,
  initialTheme,
}: {
  children: ReactNode;
  initialTheme: ThemePreference;
  initialProfileColor?: ProfileColor;
}) {
  const [theme, setThemeState] = useState<ThemePreference>(initialTheme);

  const setTheme = useCallback((t: ThemePreference) => {
    setThemeState(t);
    document.documentElement.setAttribute("data-theme", resolveTheme(t));
    document.cookie = `bl-theme=${t}; path=/; max-age=${YEAR}; SameSite=Lax`;
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
