"use client";

import { createContext, useContext, useCallback, type ReactNode } from "react";

export type Theme = "light" | "dark" | "night";
export type ProfileColor = "violet" | "teal" | "rose" | "amber" | "blue";

interface ThemeContextValue {
  theme: Theme;
  profileColor: ProfileColor;
  setTheme: (t: Theme) => void;
  setProfileColor: (c: ProfileColor) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
  initialTheme,
  initialProfileColor,
}: {
  children: ReactNode;
  initialTheme: Theme;
  initialProfileColor: ProfileColor;
}) {
  const setTheme = useCallback((t: Theme) => {
    document.documentElement.setAttribute("data-theme", t);
    document.cookie = `bl-theme=${t}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  }, []);

  const setProfileColor = useCallback((c: ProfileColor) => {
    document.documentElement.setAttribute("data-profile-color", c);
    document.cookie = `bl-profile-color=${c}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme: initialTheme,
        profileColor: initialProfileColor,
        setTheme,
        setProfileColor,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
