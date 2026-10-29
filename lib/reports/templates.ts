// RPT-01 templates. Each preselects sections; any section can be toggled.
import { t } from "@/lib/i18n";

export type SectionKey = "carecard" | "meds" | "bathroom" | "eating" | "mood" | "activity" | "flagged" | "patterns" | "questions";
export type TemplateKey = "doctor" | "therapist" | "school" | "custom";

const SECTION_KEYS: SectionKey[] = ["meds", "bathroom", "eating", "mood", "activity", "flagged", "patterns", "carecard", "questions"];

export const SECTIONS: { key: SectionKey; label: string }[] = SECTION_KEYS.map((key) => ({
  key,
  get label() {
    return t(`reports.sections.${key}`);
  },
}));

const template = (key: TemplateKey, sections: SectionKey[]) => ({
  get label() {
    return t(`reports.templates.${key}.label`);
  },
  get title() {
    return t(`reports.templates.${key}.title`);
  },
  get description() {
    return t(`reports.templates.${key}.description`);
  },
  sections,
});

export const TEMPLATES: Record<TemplateKey, { label: string; title: string; description: string; sections: SectionKey[] }> = {
  doctor: template("doctor", ["carecard", "meds", "bathroom", "eating", "mood", "flagged", "patterns", "questions"]),
  therapist: template("therapist", ["carecard", "mood", "activity", "flagged", "patterns", "questions"]),
  school: template("school", ["carecard", "mood", "bathroom", "eating", "activity"]),
  custom: template("custom", ["meds", "mood", "flagged"]),
};

// RPT-09: which care card fields print in the report header. Contacts are off by default.
export const CARD_FIELDS = ["allergies", "conditions", "communication", "calming", "contacts", "doctor"] as const;
export type CardField = (typeof CARD_FIELDS)[number];
export const DEFAULT_CARD_FIELDS: CardField[] = ["allergies", "conditions", "communication", "calming"];

export function parseCardFields(value: string | null): CardField[] {
  if (value === null) return DEFAULT_CARD_FIELDS;
  return value.split(",").filter((f): f is CardField => (CARD_FIELDS as readonly string[]).includes(f));
}

const CKEY = (profileId: string) => `bl-card-fields-${profileId}`;

export function savedCardFields(profileId: string): CardField[] {
  try {
    const raw = localStorage.getItem(CKEY(profileId));
    return raw === null ? DEFAULT_CARD_FIELDS : parseCardFields(JSON.parse(raw).join(","));
  } catch {
    return DEFAULT_CARD_FIELDS;
  }
}

export function saveCardFields(profileId: string, fields: CardField[]): void {
  try {
    localStorage.setItem(CKEY(profileId), JSON.stringify(fields));
  } catch {
    /* storage unavailable */
  }
}

export function reportHref(p: { profileId: string; from: string; to: string; template: TemplateKey; sections: SectionKey[]; cardFields?: CardField[] }): string {
  const q = new URLSearchParams({ p: p.profileId, from: p.from, to: p.to, t: p.template, s: p.sections.join(",") });
  if (p.cardFields) q.set("cc", p.cardFields.join(","));
  return `/reports/print?${q.toString()}`;
}

const QKEY = (profileId: string) => `bl-questions-${profileId}`;

export function savedQuestions(profileId: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(QKEY(profileId)) ?? "[]");
  } catch {
    return [];
  }
}

export function saveQuestions(profileId: string, qs: string[]): void {
  try {
    localStorage.setItem(QKEY(profileId), JSON.stringify(qs));
  } catch {
    /* storage unavailable */
  }
}
