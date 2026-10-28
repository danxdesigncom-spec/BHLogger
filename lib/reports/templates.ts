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

export function reportHref(p: { profileId: string; from: string; to: string; template: TemplateKey; sections: SectionKey[] }): string {
  const q = new URLSearchParams({ p: p.profileId, from: p.from, to: p.to, t: p.template, s: p.sections.join(",") });
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
