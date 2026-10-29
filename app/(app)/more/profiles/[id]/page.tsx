"use client";

import { use, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Check, Eye, EyeOff, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { Group, RadioChips } from "@/components/log/controls";
import { QuickTapsManager } from "@/components/profile/QuickTapsManager";
import { useHousehold } from "@/lib/context/household-provider";
import { useOptions, useProfileSettings } from "@/lib/data/hooks";
import { useOptionSet } from "@/lib/data/useOptionSet";
import { useRepo } from "@/lib/data/repo-context";
import { updateProfile } from "@/lib/actions/settings";
import { ACTIVITY_LIBRARY, behaviors, FEELINGS, PRN_REASONS, type Option } from "@/lib/options";
import { moveTile, orderTiles, type TileModule } from "@/lib/home/tiles";

const COLORS = ["violet", "teal", "rose", "amber", "blue"] as const;
const METHODS = ["breast", "bottle", "meal", "snack", "drink", "tube"] as const;
const input = "w-full h-button rounded-lg border border-input bg-card px-4 text-[16px] font-bold text-foreground placeholder:font-normal placeholder:text-muted-foreground";
const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

type OptModule = "activity" | "feeling" | "behavior" | "prn_reason" | "food" | "formula";

function OptionsEditor({ profileId, module, builtIn, canEdit }: { profileId: string; module: OptModule; builtIn: Option[]; canEdit: boolean }) {
  const repo = useRepo();
  const qc = useQueryClient();
  const router = useRouter();
  const settings = useProfileSettings(profileId) as { hidden_options?: Record<string, string[]> };
  const { hidden } = useOptionSet(profileId, module, builtIn);
  const customRows = useOptions(profileId, module).data ?? [];
  const [draft, setDraft] = useState("");
  const [busy, startTransition] = useTransition();
  const t = useTranslations("profileSettings");

  const toggleHidden = (key: string) =>
    startTransition(async () => {
      const current = settings.hidden_options?.[module] ?? [];
      const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
      await repo.updateProfileSettings(profileId, { hidden_options: { ...settings.hidden_options, [module]: next } });
      await qc.invalidateQueries({ queryKey: ["profile-settings"] });
      router.refresh();
    });

  return (
    <div className="space-y-2">
      <ul className="rounded-card bg-card shadow-card divide-y divide-divider">
        {builtIn.map((o) => {
          const off = hidden.has(o.key);
          return (
            <li key={o.key} className="min-h-[52px] flex items-center gap-3 px-3.5">
              <span className={`flex-1 text-body ${off ? "text-muted-foreground line-through" : "font-extrabold"}`}>{o.label}</span>
              {canEdit && (
                <button type="button" disabled={busy} aria-pressed={!off} aria-label={off ? t("show", { name: o.label }) : t("hide", { name: o.label })} onClick={() => toggleHidden(o.key)} className="min-h-touch-min flex items-center gap-1.5 px-3 text-label font-extrabold text-profile-ink">
                  {off ? <EyeOff size={16} strokeWidth={2} aria-hidden="true" /> : <Eye size={16} strokeWidth={2} aria-hidden="true" />}
                  {off ? t("hidden") : t("shown")}
                </button>
              )}
            </li>
          );
        })}
        {customRows.map((o) => (
          <li key={o.id} className="min-h-[52px] flex items-center gap-3 px-3.5">
            <span className="flex-1 text-body font-extrabold">{o.label} <span className="text-caption font-bold text-muted-foreground">{t("custom")}</span></span>
            {canEdit && (
              <button
                type="button"
                aria-label={t("archiveOption", { name: o.label })}
                onClick={() => startTransition(async () => { await repo.archiveOption(o.id); await qc.invalidateQueries({ queryKey: ["options"] }); })}
                className="w-11 h-11 rounded-full flex items-center justify-center text-muted-foreground"
              >
                <X size={18} strokeWidth={2} aria-hidden="true" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {canEdit && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const label = draft.trim();
            if (!label || customRows.some((c) => c.label.toLowerCase() === label.toLowerCase())) return;
            startTransition(async () => {
              await repo.addOption({ profileId, module, label, icon: null });
              await qc.invalidateQueries({ queryKey: ["options"] });
              setDraft("");
            });
          }}
        >
          <label className="flex-1">
            <span className="sr-only">{t("addOption")}</span>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={40} placeholder={t("addOwn")} className={`${input} rounded-full`} />
          </label>
          <button type="submit" aria-label={t("addOptionButton")} className="w-[52px] h-button flex-none rounded-full bg-primary text-primary-foreground flex items-center justify-center">
            <Plus size={20} strokeWidth={2} aria-hidden="true" />
          </button>
        </form>
      )}
    </div>
  );
}

export default function ProfileSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { profiles, currentMember } = useHousehold();
  const router = useRouter();
  const t = useTranslations("profileSettings");
  const tr = useTranslations();
  const profile = profiles.find((p) => p.id === id);
  const canEdit = currentMember.role === "admin";
  const repo = useRepo();
  const qc = useQueryClient();
  const profileSettings = useProfileSettings(profile?.id ?? null);
  const [busy, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const card = (profile?.careCard ?? {}) as {
    allergies?: string[]; conditions?: string[]; communication_notes?: string; calming_strategies?: string[];
    doctor?: { name?: string; phone?: string }; emergency_contacts?: { name: string; relationship?: string; phone?: string }[];
  };

  const [name, setName] = useState(profile?.name ?? "");
  const [color, setColor] = useState(profile?.color ?? "violet");
  const [dob, setDob] = useState(profile?.dob ?? "");
  const [stage, setStage] = useState(profile?.careStage ?? "child");
  const [toileting, setToileting] = useState(profile?.toileting ?? "toilet");
  const [methods, setMethods] = useState<string[]>(profile?.feedingMethods ?? []);
  const [allergies, setAllergies] = useState((card.allergies ?? []).join(", "));
  const [conditions, setConditions] = useState((card.conditions ?? []).join(", "));
  const [notes, setNotes] = useState(card.communication_notes ?? "");
  const [calming, setCalming] = useState((card.calming_strategies ?? []).join(", "));
  const [doctor, setDoctor] = useState({ name: card.doctor?.name ?? "", phone: card.doctor?.phone ?? "" });
  const [contact, setContact] = useState({ name: card.emergency_contacts?.[0]?.name ?? "", phone: card.emergency_contacts?.[0]?.phone ?? "" });
  const [optModule, setOptModule] = useState<OptModule>("activity");

  if (!profile) {
    return (
      <>
        <PageHeader title={t("fallbackTitle")} backHref="/more" />
        <p className="px-5 pt-4 text-body text-muted-foreground">{t("unavailable")}</p>
      </>
    );
  }

  const save = (patch: Record<string, unknown>, done: string) =>
    startTransition(async () => {
      const r = await updateProfile(profile.id, patch);
      setMessage("error" in r ? r.error : done);
      router.refresh();
    });

  const tileOrder = orderTiles(profileSettings.tile_order);
  const moveModule = (m: TileModule, by: -1 | 1, label: string) =>
    startTransition(async () => {
      const r = await repo.updateProfileSettings(profile.id, { tile_order: moveTile(tileOrder, m, by) });
      setMessage("error" in r ? r.error : t(by < 0 ? "movedUp" : "movedDown", { name: label }));
      await qc.invalidateQueries({ queryKey: ["profile-settings"] });
      router.refresh();
    });

  const builtIns: Record<OptModule, Option[]> = {
    activity: ACTIVITY_LIBRARY[stage],
    feeling: FEELINGS[stage],
    behavior: behaviors(stage),
    prn_reason: [...PRN_REASONS],
    food: [],
    formula: [],
  };

  return (
    <>
      <PageHeader title={profile.name} subtitle={t("subtitle")} backHref="/more" backLabel={tr("settings.backToMore")} />
      <div className="px-5 pt-3 pb-8 space-y-6">
        {!canEdit && <p className="text-caption text-muted-foreground">{t("adminOnly")}</p>}

        <section aria-labelledby="details-h" className="space-y-4">
          <h2 id="details-h" className="font-display text-title-5">{t("details")}</h2>
          <fieldset disabled={!canEdit || busy} className="space-y-4">
            <label className="flex flex-col gap-2">
              <span className="text-label text-muted-foreground">{t("name")}</span>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className={input} />
            </label>
            <Group label={t("color")}>
              <div role="radiogroup" aria-label={t("color")} className="flex gap-3">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={color === c}
                    aria-label={tr(`options.color.${c}`)}
                    onClick={() => setColor(c)}
                    data-profile-color={c}
                    className="w-11 h-11 rounded-full bg-profile text-on-profile flex items-center justify-center"
                    style={color === c ? { boxShadow: "0 0 0 3px var(--card), 0 0 0 5px var(--foreground)" } : undefined}
                  >
                    {color === c && <Check size={18} strokeWidth={3} aria-hidden="true" />}
                  </button>
                ))}
              </div>
            </Group>
            <label className="flex flex-col gap-2">
              <span className="text-label text-muted-foreground">{t("birthday")}</span>
              <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={input} />
            </label>
            <Group label={t("careStage")}>
              <RadioChips label={t("careStage")} value={stage} onChange={setStage} options={(["baby", "child", "teen_adult"] as const).map((v) => ({ value: v, label: tr(`options.careStage.${v}`) }))} />
            </Group>
            <Group label={t("toileting")}>
              <RadioChips label={t("toileting")} value={toileting} onChange={setToileting} options={[{ value: "diapers", label: tr(stage === "teen_adult" ? "options.toileting.briefs" : "options.toileting.diapers") }, { value: "training", label: tr("options.toileting.training") }, { value: "toilet", label: tr("options.toileting.toilet") }]} />
            </Group>
            <Group label={t("feeding")}>
              <div className="flex flex-wrap gap-2">
                {METHODS.map((m) => {
                  const on = methods.includes(m);
                  return (
                    <button key={m} type="button" aria-pressed={on} onClick={() => setMethods((xs) => (on ? xs.filter((x) => x !== m) : [...xs, m]))} className={`min-h-touch-min px-4 flex items-center gap-1.5 rounded-full border text-body ${on ? "bg-profile border-profile text-on-profile font-extrabold" : "bg-secondary border-border"}`}>
                      {on && <Check size={16} strokeWidth={2.5} aria-hidden="true" />}{tr(`options.feedingPlural.${m}`)}
                    </button>
                  );
                })}
              </div>
            </Group>
            {canEdit && (
              <button type="button" onClick={() => save({ name, color, dob: dob || null, care_stage: stage, toileting, feeding_methods: methods }, t("detailsSaved"))} className="w-full h-button rounded-full bg-primary text-primary-foreground text-body-lg disabled:opacity-60">
                {t("saveDetails")}
              </button>
            )}
          </fieldset>
        </section>

        <section aria-labelledby="modules-h" className="space-y-2">
          <h2 id="modules-h" className="font-display text-title-5">{t("modules")}</h2>
          <p className="text-caption text-muted-foreground">{t("modulesHint")}</p>
          <div className="rounded-card bg-card shadow-card divide-y divide-divider">
            {tileOrder.map((m, i) => {
              const on = profile.enabledModules.includes(m);
              const label = m === "mood" ? t("moodAndBehaviors") : tr(`modules.${m}`);
              return (
                <div key={m} className="min-h-[56px] flex items-center gap-1 pl-4 pr-3">
                  <span id={`mod-${m}`} className="flex-1 text-body font-extrabold">{label}</span>
                  {canEdit && (
                    <>
                      <button type="button" disabled={busy || i === 0} aria-label={t("moveUp", { name: label })} onClick={() => moveModule(m, -1, label)} className="w-11 h-11 flex-none rounded-full flex items-center justify-center text-muted-foreground disabled:opacity-30">
                        <ArrowUp size={18} strokeWidth={2} aria-hidden="true" />
                      </button>
                      <button type="button" disabled={busy || i === tileOrder.length - 1} aria-label={t("moveDown", { name: label })} onClick={() => moveModule(m, 1, label)} className="w-11 h-11 flex-none rounded-full flex items-center justify-center text-muted-foreground disabled:opacity-30">
                        <ArrowDown size={18} strokeWidth={2} aria-hidden="true" />
                      </button>
                    </>
                  )}
                  <input
                    type="checkbox"
                    role="switch"
                    aria-labelledby={`mod-${m}`}
                    className="switch ml-2"
                    checked={on}
                    disabled={!canEdit || busy || (on && profile.enabledModules.length === 1)}
                    onChange={() => save({ enabled_modules: on ? profile.enabledModules.filter((x) => x !== m) : [...profile.enabledModules, m] }, on ? t("moduleHidden", { name: label }) : t("moduleShown", { name: label }))}
                  />
                </div>
              );
            })}
          </div>
        </section>

        <QuickTapsManager profileId={profile.id} canEdit={currentMember.role !== "viewer"} />

        <section aria-labelledby="options-h" className="space-y-3">
          <h2 id="options-h" className="font-display text-title-5">{t("optionLists")}</h2>
          <p className="text-caption text-muted-foreground">{t("optionListsHint")}</p>
          <RadioChips<OptModule>
            label={t("list")}
            value={optModule}
            onChange={setOptModule}
            options={[
              { value: "activity", label: t("activities") },
              { value: "feeling", label: t("feelings") },
              ...(stage !== "baby" ? [{ value: "behavior" as const, label: t("behaviors") }] : []),
              { value: "prn_reason", label: t("prnReasons") },
              { value: "food", label: t("foods") },
              ...(methods.includes("tube") ? [{ value: "formula" as const, label: t("formulas") }] : []),
            ]}
          />
          <OptionsEditor key={optModule} profileId={profile.id} module={optModule} builtIn={builtIns[optModule]} canEdit={canEdit} />
        </section>

        <section id="care-card" aria-labelledby="card-h" className="space-y-3 scroll-mt-4">
          <h2 id="card-h" className="font-display text-title-5">{t("careCard")}</h2>
          <p className="text-caption text-muted-foreground">{t("careCardHint")}</p>
          <fieldset disabled={!canEdit || busy} className="space-y-3">
            {[
              [t("allergies"), allergies, setAllergies, t("commaHint")],
              [t("conditions"), conditions, setConditions, t("commaHint")],
              [t("calming"), calming, setCalming, t("commaHint")],
            ].map(([label, value, set, ph]) => (
              <label key={label as string} className="flex flex-col gap-1.5">
                <span className="text-label text-muted-foreground">{label as string}</span>
                <input value={value as string} onChange={(e) => (set as (v: string) => void)(e.target.value)} placeholder={ph as string} className={input} />
              </label>
            ))}
            <label className="flex flex-col gap-1.5">
              <span className="text-label text-muted-foreground">{t("communication")}</span>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={500} className="rounded-lg border border-input bg-card px-4 py-3 text-[16px] font-bold resize-none" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1.5"><span className="text-label text-muted-foreground">{t("doctor")}</span><input value={doctor.name} onChange={(e) => setDoctor({ ...doctor, name: e.target.value })} className={input} /></label>
              <label className="flex flex-col gap-1.5"><span className="text-label text-muted-foreground">{t("doctorPhone")}</span><input type="tel" value={doctor.phone} onChange={(e) => setDoctor({ ...doctor, phone: e.target.value })} className={input} /></label>
              <label className="flex flex-col gap-1.5"><span className="text-label text-muted-foreground">{t("emergency")}</span><input value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} className={input} /></label>
              <label className="flex flex-col gap-1.5"><span className="text-label text-muted-foreground">{t("theirPhone")}</span><input type="tel" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} className={input} /></label>
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={() =>
                  save(
                    {
                      care_card: {
                        allergies: list(allergies), conditions: list(conditions), calming_strategies: list(calming),
                        communication_notes: notes.trim() || undefined,
                        doctor: doctor.name || doctor.phone ? { name: doctor.name.trim(), phone: doctor.phone.trim() } : undefined,
                        emergency_contacts: contact.name ? [{ name: contact.name.trim(), phone: contact.phone.trim(), ...(card.emergency_contacts?.[0]?.relationship ? { relationship: card.emergency_contacts[0].relationship } : {}) }] : [],
                      },
                    },
                    t("cardSaved"),
                  )
                }
                className="w-full h-button rounded-full bg-primary text-primary-foreground text-body-lg disabled:opacity-60"
              >
                {t("saveCard")}
              </button>
            )}
          </fieldset>
        </section>

        {message && <p role="status" className="text-label font-bold text-foreground-2 text-center">{message}</p>}
      </div>
    </>
  );
}
