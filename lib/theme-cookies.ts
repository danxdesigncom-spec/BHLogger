import { cookies } from "next/headers";
import { NIGHT_COOKIE, parseNight, serverNight, type NightPrefs } from "@/lib/night";
import { parseThemePreference, type ThemePreference } from "@/lib/theme";

/** The device's theme choice (SET-02) and night mode (SET-03), read from its cookies on the server. */
export async function readThemeCookies(): Promise<{ theme: ThemePreference; night: NightPrefs; nightNow: boolean }> {
  const store = await cookies();
  const night = parseNight(store.get(NIGHT_COOKIE)?.value);
  return { theme: parseThemePreference(store.get("bl-theme")?.value), night, nightNow: serverNight(night, new Date()) };
}
