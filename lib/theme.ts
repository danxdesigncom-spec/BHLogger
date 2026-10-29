// Shared by the server layouts and the client ThemeProvider.

export type Theme = "light" | "dark" | "night";
/** SET-02. Night mode (SET-03) is a separate switch on top of this, not a theme choice. */
export type ThemePreference = "light" | "dark" | "system";
export type ProfileColor = "violet" | "teal" | "rose" | "amber" | "blue";

export function parseThemePreference(value: string | undefined): ThemePreference {
  return value === "dark" || value === "system" ? value : "light";
}
