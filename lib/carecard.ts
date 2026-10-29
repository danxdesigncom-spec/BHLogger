// ACC-12 care card: read the stored JSON safely, and the text each field prints as (RPT-09).
import type { CardField } from "@/lib/reports/templates";
import { t } from "@/lib/i18n";

export interface CareCardView {
  allergies: string[];
  conditions: string[];
  communication_notes: string;
  calming_strategies: string[];
  emergency_contacts: { name: string; relationship?: string; phone?: string }[];
  doctor: { name?: string; phone?: string } | null;
}

const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : []);
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function readCareCard(raw: unknown): CareCardView {
  const c = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const contacts = Array.isArray(c.emergency_contacts) ? c.emergency_contacts : [];
  const doctor = c.doctor && typeof c.doctor === "object" ? (c.doctor as Record<string, unknown>) : null;
  return {
    allergies: strings(c.allergies),
    conditions: strings(c.conditions),
    communication_notes: text(c.communication_notes),
    calming_strategies: strings(c.calming_strategies),
    emergency_contacts: contacts
      .filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && text((x as Record<string, unknown>).name) !== "")
      .map((x) => ({ name: text(x.name), relationship: text(x.relationship) || undefined, phone: text(x.phone) || undefined })),
    doctor: doctor && (text(doctor.name) || text(doctor.phone)) ? { name: text(doctor.name) || undefined, phone: text(doctor.phone) || undefined } : null,
  };
}

export function isCardEmpty(c: CareCardView): boolean {
  return !c.allergies.length && !c.conditions.length && !c.communication_notes && !c.calming_strategies.length && !c.emergency_contacts.length && !c.doctor;
}

const person = (p: { name?: string; relationship?: string; phone?: string }) =>
  [p.relationship ? t("careCard.personWithRole", { name: p.name ?? "", role: p.relationship }) : p.name, p.phone].filter(Boolean).join(", ");

/** One line per field, or "" when the field is empty. */
export function cardFieldText(raw: unknown, field: CardField): string {
  const c = readCareCard(raw);
  switch (field) {
    case "allergies": return c.allergies.join(", ");
    case "conditions": return c.conditions.join(", ");
    case "communication": return c.communication_notes;
    case "calming": return c.calming_strategies.join(", ");
    case "contacts": return c.emergency_contacts.map(person).join("; ");
    case "doctor": return c.doctor ? person(c.doctor) : "";
  }
}

/** A tel: link for a typed phone number, keeping digits and a leading +. Null when there's nothing to dial. */
export function telHref(phone: string | undefined): string | null {
  if (!phone) return null;
  const digits = phone.trim().replace(/(?!^\+)[^\d]/g, "");
  return digits.replace(/\D/g, "").length >= 3 ? `tel:${digits}` : null;
}
