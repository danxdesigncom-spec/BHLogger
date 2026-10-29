import { describe, expect, it } from "vitest";
import {
  DEFAULT_NIGHT, IS_NIGHT_JS, inWindow, isNight, nightUntil, parseNight, serializeNight, serverNight, setNightSchedule,
  themeScript, turnNight, windowEnd, type NightPrefs,
} from "@/lib/night";
import { formatWhen } from "@/lib/entries/summary";
import { generateHouseholdData, isOvernight, SEED_IDS, storyAnchor, storyDayStart } from "@/lib/demo/generate";

// M12d: night mode (SET-03, S26 and S27). All times are local, like the device clock the rules read.
const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute); // October 2026
const AUTO: NightPrefs = { ...DEFAULT_NIGHT, auto: true };
const NIGHT = at(27, 3, 5); // the night mockups' 3:05 AM

describe("SET-03 automatic hours", () => {
  it("are off by default, 8 PM to 6 AM when turned on", () => {
    expect(DEFAULT_NIGHT).toMatchObject({ auto: false, from: "20:00", to: "06:00", override: null });
    expect(isNight(DEFAULT_NIGHT, NIGHT)).toBe(false);
    expect(isNight(AUTO, NIGHT)).toBe(true);
  });

  it("wrap past midnight and include the start but not the end", () => {
    expect(inWindow(AUTO, at(26, 19, 59))).toBe(false);
    expect(inWindow(AUTO, at(26, 20, 0))).toBe(true);
    expect(inWindow(AUTO, at(27, 0, 0))).toBe(true);
    expect(inWindow(AUTO, at(27, 5, 59))).toBe(true);
    expect(inWindow(AUTO, at(27, 6, 0))).toBe(false);
    expect(inWindow({ from: "13:00", to: "15:00" }, at(26, 14, 0))).toBe(true);
    expect(inWindow({ from: "13:00", to: "15:00" }, at(26, 16, 0))).toBe(false);
    expect(inWindow({ from: "22:00", to: "22:00" }, at(26, 22, 0))).toBe(false);
  });

  it("end at the window's own 6 AM, or the next one's when outside it", () => {
    expect(windowEnd(AUTO, at(26, 21, 0))).toEqual(at(27, 6, 0));
    expect(windowEnd(AUTO, NIGHT)).toEqual(at(27, 6, 0));
    expect(windowEnd(AUTO, at(26, 12, 0))).toEqual(at(27, 6, 0));
    expect(nightUntil(AUTO, NIGHT)).toEqual(at(27, 6, 0));
    expect(nightUntil(AUTO, at(26, 12, 0))).toBeUndefined();
  });
});

describe("SET-03 switch and moon button", () => {
  it("the moon button turns it off until the next window starts", () => {
    const off = turnNight(AUTO, false, NIGHT);
    expect(off.override).toEqual({ on: false, until: at(27, 6, 0).toISOString() });
    expect(isNight(off, NIGHT)).toBe(false);
    expect(isNight(off, at(27, 5, 59))).toBe(false);
    expect(isNight(off, at(27, 12, 0))).toBe(false);
    expect(isNight(off, at(27, 20, 0))).toBe(true);
  });

  it("turned on by hand stays on until turned off, or until the next window ends when automatic", () => {
    const manual = turnNight(DEFAULT_NIGHT, true, at(26, 15, 0));
    expect(manual.override).toEqual({ on: true, until: null });
    expect(isNight(manual, at(30, 12, 0))).toBe(true);
    expect(nightUntil(manual, at(26, 15, 0))).toBeNull();
    expect(isNight(turnNight(manual, false, at(26, 16, 0)), at(26, 16, 0))).toBe(false);

    const early = turnNight(AUTO, true, at(26, 19, 0));
    expect(nightUntil(early, at(26, 19, 0))).toEqual(at(27, 6, 0));
    expect(isNight(early, at(27, 6, 0))).toBe(false);
  });

  it("turned back on inside the window, the schedule takes over again", () => {
    const back = turnNight(turnNight(AUTO, false, NIGHT), true, at(27, 4, 0));
    expect(back.override).toBeNull();
    expect(isNight(back, at(27, 4, 0))).toBe(true);
  });

  it("only a choice made by hand is known to the server", () => {
    expect(serverNight(AUTO, NIGHT)).toBe(false);
    expect(serverNight(turnNight(DEFAULT_NIGHT, true, NIGHT), NIGHT)).toBe(true);
  });
});

describe("SET-03 changing the hours", () => {
  it("applies the new schedule right away", () => {
    expect(isNight(setNightSchedule(DEFAULT_NIGHT, { auto: true }, at(26, 21, 0)), at(26, 21, 0))).toBe(true);
    expect(isNight(setNightSchedule(AUTO, { from: "22:00" }, at(26, 21, 0)), at(26, 21, 0))).toBe(false);
  });

  it("keeps night mode off for the rest of a window it was turned off in", () => {
    const off = turnNight(AUTO, false, NIGHT);
    const later = setNightSchedule(off, { to: "07:00" }, NIGHT);
    expect(later.override).toEqual({ on: false, until: at(27, 7, 0).toISOString() });
    expect(setNightSchedule(off, { auto: false }, NIGHT).override).toBeNull();
  });

  it("keeps night mode on when it was turned on by hand", () => {
    const manual = turnNight(DEFAULT_NIGHT, true, at(26, 15, 0));
    const auto = setNightSchedule(manual, { auto: true }, at(26, 15, 0));
    expect(nightUntil(auto, at(26, 15, 0))).toEqual(at(27, 6, 0));
    expect(setNightSchedule(auto, { auto: false }, at(26, 15, 0)).override).toEqual({ on: true, until: null });
  });
});

describe("SET-03 stored per device", () => {
  it("round-trips the cookie and falls back to the defaults when it's malformed", () => {
    const off = turnNight(AUTO, false, NIGHT);
    expect(parseNight(serializeNight(off))).toEqual(off);
    expect(parseNight(undefined)).toEqual(DEFAULT_NIGHT);
    expect(parseNight("%7Bnot json")).toEqual(DEFAULT_NIGHT);
    expect(parseNight(encodeURIComponent(JSON.stringify({ auto: true, from: "25:00", to: "6", override: { on: "yes" } })))).toEqual(AUTO);
  });

  it("the head script follows the same rule as isNight", () => {
    const js = new Function(`return ${IS_NIGHT_JS}`)() as (n: NightPrefs, d: Date) => boolean;
    const prefs: NightPrefs[] = [
      DEFAULT_NIGHT, AUTO, { ...AUTO, from: "13:00", to: "15:00" }, { ...AUTO, from: "21:00", to: "21:00" },
      turnNight(AUTO, false, NIGHT), turnNight(DEFAULT_NIGHT, true, NIGHT), turnNight(AUTO, true, at(26, 12, 0)),
    ];
    for (const n of prefs) {
      for (let m = 0; m < 48 * 60; m += 17) {
        const d = new Date(at(26, 0, 0).getTime() + m * 60_000);
        expect(js(n, d), `${JSON.stringify(n)} at ${d.toString()}`).toBe(isNight(n, d));
      }
    }
  });

  it("the head script sets data-theme, and can't be broken out of", () => {
    const run = (pref: "light" | "dark" | "system", n: NightPrefs) => {
      const root = { dataset: {} as Record<string, string> };
      new Function("document", "matchMedia", themeScript(pref, n))({ documentElement: root }, () => ({ matches: true }));
      return root.dataset.theme;
    };
    expect(run("light", turnNight(DEFAULT_NIGHT, true, new Date()))).toBe("night");
    expect(run("dark", DEFAULT_NIGHT)).toBe("dark");
    expect(run("system", DEFAULT_NIGHT)).toBe("dark");
    expect(themeScript("light", { ...DEFAULT_NIGHT, from: "</script><script>" } as NightPrefs)).not.toContain("</script>");
  });

  it("the head script prefers this device's cookies, since a cached page carries old values", () => {
    const run = (cookie: string) => {
      const root = { dataset: {} as Record<string, string> };
      new Function("document", "matchMedia", themeScript("light", DEFAULT_NIGHT))({ cookie, documentElement: root }, () => ({ matches: false }));
      return root.dataset.theme;
    };
    const on = serializeNight(turnNight(DEFAULT_NIGHT, true, new Date()));
    expect(run(`bl-theme=dark; bl-night=${on}`)).toBe("night");
    expect(run("bl-theme=dark")).toBe("dark");
    expect(run("bl-theme=night; bl-night=%7Bbroken")).toBe("light");
  });
});

describe("S26 and S27 wording", () => {
  it("shows a feed from earlier tonight by its time, not as yesterday", () => {
    expect(formatWhen(at(26, 22, 40).toISOString(), NIGHT)).toBe("10:40 PM");
    expect(formatWhen(at(26, 20, 0).toISOString(), at(27, 6, 30))).toBe("Yesterday 8:00 PM");
  });

  it("the demo story's night: from midnight to 5 AM, the day before is the story's today", () => {
    expect(isOvernight(NIGHT)).toBe(true);
    expect(isOvernight(at(27, 5, 0))).toBe(false);
    expect(storyDayStart(NIGHT)).toEqual(at(26, 0, 0));
    const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const night = generateHouseholdData({ anchor: NIGHT, tz: TZ }).entries.filter((e) => e.profile_id === SEED_IDS.maya);
    const last = (type: string) => night.filter((e) => e.type === type).at(-1)!;
    expect(new Date(last("eating").occurred_at)).toEqual(at(26, 22, 40));
    expect(last("eating").data).toMatchObject({ method: "bottle", amount_ml: 118 });
    expect(new Date(last("bathroom").occurred_at)).toEqual(at(26, 22, 35));
    const day = generateHouseholdData({ anchor: storyAnchor(), tz: TZ }).entries;
    expect(day.some((e) => new Date(e.occurred_at).getTime() > storyAnchor().getTime())).toBe(false);
  });
});
