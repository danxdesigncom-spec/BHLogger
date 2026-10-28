// RPT-01 templates. Each preselects sections; any section can be toggled.

export type SectionKey = "carecard" | "meds" | "bathroom" | "eating" | "mood" | "activity" | "flagged" | "patterns" | "questions";
export type TemplateKey = "doctor" | "therapist" | "school" | "custom";

export const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: "meds", label: "Medications" },
  { key: "bathroom", label: "Bathroom" },
  { key: "eating", label: "Eating" },
  { key: "mood", label: "Mood, behaviors" },
  { key: "activity", label: "Activities" },
  { key: "flagged", label: "Flagged notes" },
  { key: "patterns", label: "Patterns" },
  { key: "carecard", label: "Allergies and care notes" },
  { key: "questions", label: "Questions for the visit" },
];

export const TEMPLATES: Record<TemplateKey, { label: string; title: string; description: string; sections: SectionKey[] }> = {
  doctor: {
    label: "Doctor visit",
    title: "Doctor visit report",
    description: "Medications, bathroom, eating, mood and anything you flagged for the doctor",
    sections: ["carecard", "meds", "bathroom", "eating", "mood", "flagged", "patterns", "questions"],
  },
  therapist: {
    label: "Therapist",
    title: "Therapy report",
    description: "Mood, behaviors, activities and the patterns behind them",
    sections: ["carecard", "mood", "activity", "flagged", "patterns", "questions"],
  },
  school: {
    label: "School",
    title: "School and IEP team report",
    description: "Mood, behaviors, toileting, eating and activities, for the school team",
    sections: ["carecard", "mood", "bathroom", "eating", "activity"],
  },
  custom: {
    label: "Custom",
    title: "Care report",
    description: "Pick exactly what to include",
    sections: ["meds", "mood", "flagged"],
  },
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
