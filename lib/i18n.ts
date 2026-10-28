// SET-08: one source of strings. Components use next-intl's useTranslations; non-React code
// (option labels, summaries, insight headlines, report text) uses t() over the same messages.
// Adding a language means adding messages/<locale>.json and listing it here.
import { createTranslator } from "next-intl";
import en from "@/messages/en.json";

export const MESSAGES = { en } as const;
export type Locale = keyof typeof MESSAGES;
export const DEFAULT_LOCALE: Locale = "en";

type Values = Record<string, string | number | Date>;
type Translate = (key: string, values?: Values) => string;

let current: Locale = DEFAULT_LOCALE;
const cache = new Map<Locale, Translate>();

/** Called by HouseholdProvider on the client with the household's locale. */
export function setLocale(locale: string): void {
  if (typeof window !== "undefined" && locale in MESSAGES) current = locale as Locale;
}

function translator(): Translate {
  let fn = cache.get(current);
  if (!fn) {
    fn = createTranslator({ locale: current, messages: MESSAGES[current] }) as unknown as Translate;
    cache.set(current, fn);
  }
  return fn;
}

export function t(key: string, values?: Values): string {
  return translator()(key, values);
}

/** Whether a message exists, for option keys that may be custom (user-added) rather than built in. */
export function has(key: string): boolean {
  let node: unknown = MESSAGES[current];
  for (const part of key.split(".")) {
    if (!node || typeof node !== "object" || !(part in node)) return false;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string";
}
