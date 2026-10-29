"use client";

import Link from "next/link";
import { AlertTriangle, ChevronLeft, Pencil, Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ProfileSummary } from "@/lib/context/household-provider";
import { isCardEmpty, readCareCard, telHref } from "@/lib/carecard";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-label font-extrabold text-muted-foreground">{label}</p>
      <div className="text-body text-foreground">{children}</div>
    </div>
  );
}

function Call({ name, detail, phone }: { name: string; detail?: string; phone?: string }) {
  const t = useTranslations("careCard");
  const href = telHref(phone);
  return (
    <li className="flex items-center gap-3 min-h-16 px-3.5 rounded-xl bg-secondary">
      <span className="flex-1 min-w-0">
        <span className="block text-body font-extrabold truncate">{name}</span>
        {(detail || phone) && <span className="block text-caption text-muted-foreground">{[detail, phone].filter(Boolean).join(" · ")}</span>}
      </span>
      {href && (
        <a href={href} aria-label={t("call", { name })} className="flex-none min-h-touch-min px-4 flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground text-label font-extrabold">
          <Phone size={16} strokeWidth={2} aria-hidden="true" /> {t("callShort")}
        </a>
      )}
    </li>
  );
}

/** ACC-12: read-only care card, opened from the profile switcher (2 taps from any tab). Admins get an edit link. */
export function CareCardView({ profile, canEdit, onBack, onClose }: { profile: ProfileSummary; canEdit: boolean; onBack: () => void; onClose: () => void }) {
  const t = useTranslations("careCard");
  const card = readCareCard(profile.careCard);
  const empty = isCardEmpty(card);

  return (
    <div data-profile-color={profile.color} className="px-5 pt-3 space-y-4 max-h-[78vh] overflow-y-auto">
      <div className="flex items-center gap-2 -ml-2">
        <button type="button" onClick={onBack} aria-label={t("back")} className="w-11 h-11 flex-none rounded-full flex items-center justify-center text-foreground">
          <ChevronLeft size={22} strokeWidth={2} aria-hidden="true" />
        </button>
        <h2 id="switch-title" className="font-display text-title-2 flex-1">{t("title", { name: profile.name })}</h2>
      </div>

      {empty ? (
        <p className="text-body text-muted-foreground">{t("empty", { name: profile.name })}</p>
      ) : (
        <div className="space-y-4">
          {card.allergies.length > 0 ? (
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-flag border border-flag-border text-flag-ink">
              <AlertTriangle size={20} strokeWidth={2} className="flex-none mt-0.5" aria-hidden="true" />
              <div className="space-y-0.5">
                <p className="text-label font-extrabold">{t("allergies")}</p>
                <p className="text-body-md">{card.allergies.join(", ")}</p>
              </div>
            </div>
          ) : (
            <Field label={t("allergies")}>{t("noneRecorded")}</Field>
          )}
          {card.conditions.length > 0 && <Field label={t("conditions")}>{card.conditions.join(", ")}</Field>}
          {card.communication_notes && <Field label={t("communication")}>{card.communication_notes}</Field>}
          {card.calming_strategies.length > 0 && (
            <Field label={t("calming")}>
              <ul className="list-disc pl-5 space-y-0.5">{card.calming_strategies.map((s) => <li key={s}>{s}</li>)}</ul>
            </Field>
          )}
        </div>
      )}

      {(card.emergency_contacts.length > 0 || card.doctor) && (
        <section aria-labelledby="cc-contacts" className="space-y-2">
          <h3 id="cc-contacts" className="text-label font-extrabold text-muted-foreground">{t("contacts")}</h3>
          <ul className="space-y-2">
            {card.emergency_contacts.map((c, i) => <Call key={`${c.name}-${i}`} name={c.name} detail={c.relationship ?? t("emergency")} phone={c.phone} />)}
            {card.doctor && <Call name={card.doctor.name ?? t("doctor")} detail={t("doctor")} phone={card.doctor.phone} />}
          </ul>
        </section>
      )}

      {canEdit && (
        <Link href={`/more/profiles/${profile.id}#care-card`} onClick={onClose} className="w-full min-h-touch-min flex items-center justify-center gap-2 rounded-full border-[1.5px] border-border-strong bg-card text-body-md">
          <Pencil size={16} strokeWidth={2} aria-hidden="true" /> {t("edit")}
        </Link>
      )}
    </div>
  );
}
