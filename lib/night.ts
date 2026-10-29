// SET-03 night mode. Stored per device (DESIGN 8) in the `bl-night` cookie, so the server and the
// inline head script can pick the theme before first paint. Hours are the device's local time.

export interface NightPrefs {
  /** "Turn on automatically" between `from` and `to`. Off by default. */
  auto: boolean;
  from: string;
  to: string;
  /**
   * A choice that wins over the schedule until `until` (ISO; null = until changed). The moon button
   * writes { on: false, until: end of this window }, so night mode stays off until the next window.
   */
  override: { on: boolean; until: string | null } | null;
}

export const NIGHT_COOKIE = "bl-night";
export const DEFAULT_NIGHT: NightPrefs = { auto: false, from: "20:00", to: "06:00", override: null };

const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
const minutes = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));

/** Reads the cookie value; anything malformed falls back to the defaults. */
export function parseNight(raw: string | undefined | null): NightPrefs {
  if (!raw) return DEFAULT_NIGHT;
  try {
    const v = JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>;
    const o = v.override as Record<string, unknown> | null | undefined;
    const until = o && typeof o.until === "string" && !Number.isNaN(Date.parse(o.until)) ? new Date(o.until).toISOString() : null;
    return {
      auto: v.auto === true,
      from: typeof v.from === "string" && HM.test(v.from) ? v.from : DEFAULT_NIGHT.from,
      to: typeof v.to === "string" && HM.test(v.to) ? v.to : DEFAULT_NIGHT.to,
      override: o && typeof o.on === "boolean" ? { on: o.on, until } : null,
    };
  } catch {
    return DEFAULT_NIGHT;
  }
}

export function serializeNight(n: NightPrefs): string {
  return encodeURIComponent(JSON.stringify(n));
}

const activeOverride = (n: NightPrefs, now: Date) =>
  n.override && (n.override.until === null || Date.parse(n.override.until) > now.getTime()) ? n.override : null;

/** True when `now` falls inside the from–to window. Overnight windows wrap; from = to is an empty window. */
export function inWindow(n: Pick<NightPrefs, "from" | "to">, now: Date): boolean {
  const m = now.getHours() * 60 + now.getMinutes();
  const f = minutes(n.from);
  const t = minutes(n.to);
  return f < t ? m >= f && m < t : f > t ? m >= f || m < t : false;
}

/** The next local time after `after` that reads `hm`. */
function nextAt(hm: string, after: Date): Date {
  const d = new Date(after);
  d.setHours(Number(hm.slice(0, 2)), Number(hm.slice(3, 5)), 0, 0);
  if (d.getTime() <= after.getTime()) d.setDate(d.getDate() + 1);
  return d;
}

/** The end of the window `now` is in, or of the next one when it's outside. */
export function windowEnd(n: Pick<NightPrefs, "from" | "to">, now: Date): Date {
  return inWindow(n, now) ? nextAt(n.to, now) : nextAt(n.to, nextAt(n.from, now));
}

export function isNight(n: NightPrefs, now: Date): boolean {
  const o = activeOverride(n, now);
  if (o) return o.on;
  return n.auto && inWindow(n, now);
}

/**
 * When night mode turns itself off: a Date, null when it stays on until someone turns it off, or
 * undefined when it isn't on.
 */
export function nightUntil(n: NightPrefs, now: Date): Date | null | undefined {
  if (!isNight(n, now)) return undefined;
  const o = activeOverride(n, now);
  if (o) return o.until ? new Date(o.until) : null;
  return windowEnd(n, now);
}

/**
 * The night switch and the moon button.
 * - Off inside an automatic window: off until that window ends, so it next comes on at the next start.
 * - On inside an automatic window: the schedule covers it.
 * - On outside the window: on until the next window ends when automatic, otherwise until turned off.
 */
export function turnNight(n: NightPrefs, on: boolean, now: Date): NightPrefs {
  const scheduled = n.auto && inWindow(n, now);
  if (!on) return { ...n, override: scheduled ? { on: false, until: windowEnd(n, now).toISOString() } : null };
  if (scheduled) return { ...n, override: null };
  return { ...n, override: { on: true, until: n.auto ? windowEnd(n, now).toISOString() : null } };
}

/**
 * Changing "Turn on automatically" or the hours. The new schedule applies right away, except that a
 * choice made by hand is kept: night mode turned off inside the window stays off for the rest of it,
 * and night mode turned on stays on (until the next window ends when automatic).
 */
export function setNightSchedule(n: NightPrefs, patch: Partial<Pick<NightPrefs, "auto" | "from" | "to">>, now: Date): NightPrefs {
  const next: NightPrefs = { ...n, ...patch, override: null };
  const o = activeOverride(n, now);
  if (!o) return next;
  const scheduled = next.auto && inWindow(next, now);
  if (!o.on) return scheduled ? { ...next, override: { on: false, until: windowEnd(next, now).toISOString() } } : next;
  if (scheduled) return next;
  return { ...next, override: { on: true, until: next.auto ? windowEnd(next, now).toISOString() : null } };
}

/** What the server can tell without the device clock's time zone: only a choice made by hand. */
export function serverNight(n: NightPrefs, now: Date): boolean {
  return activeOverride(n, now)?.on ?? false;
}

/**
 * The same rule as `isNight`, as a script for <head>: it runs before first paint, so an automatic
 * window doesn't flash the day theme. A unit test checks it against `isNight`.
 */
export const IS_NIGHT_JS =
  'function(n,d){var o=n.override;if(o&&(o.until===null||Date.parse(o.until)>d.getTime()))return o.on;if(!n.auto)return false;' +
  'var h=function(s){return +s.slice(0,2)*60+ +s.slice(3,5)},m=d.getHours()*60+d.getMinutes(),f=h(n.from),t=h(n.to);' +
  "return f<t?m>=f&&m<t:f>t?m>=f||m<t:false}";

/**
 * Sets data-theme from the theme choice and night mode before the page paints. It prefers this device's
 * cookies over the values the server wrote in, because the service worker can serve a page cached earlier.
 */
export function themeScript(pref: "light" | "dark" | "system", night: NightPrefs): string {
  const json = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");
  return (
    `(function(){try{var p=${json(pref)},n=${json(night)},isNight=${IS_NIGHT_JS};` +
    'try{var c=function(k){var m=document.cookie.match(new RegExp("(?:^|; )"+k+"=([^;]*)"));return m?decodeURIComponent(m[1]):null},' +
    't=c("bl-theme"),v=c("bl-night"),hm=/^\\d\\d:\\d\\d$/;if(t==="light"||t==="dark"||t==="system")p=t;' +
    'if(v){v=JSON.parse(v);if(v&&hm.test(v.from)&&hm.test(v.to))n=v}}catch(e){}' +
    'document.documentElement.dataset.theme=isNight(n,new Date())?"night":p==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):p' +
    "}catch(e){}})()"
  );
}

/** A cookie's raw value on this device, or undefined. */
export function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? m[1] : undefined;
}
