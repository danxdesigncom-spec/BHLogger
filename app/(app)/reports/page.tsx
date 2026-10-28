"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Check, Download, FileText, Plus, Share2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { AppHeader } from "@/components/layout/AppHeader";
import { Group, RadioChips } from "@/components/log/controls";
import { useHousehold } from "@/lib/context/household-provider";
import { useAppointments, useEntries } from "@/lib/data/hooks";
import { useRepo } from "@/lib/data/repo-context";
import { entriesToCsv, downloadText } from "@/lib/reports/csv";
import { reportHref, saveQuestions, savedQuestions, SECTIONS, TEMPLATES, type SectionKey, type TemplateKey } from "@/lib/reports/templates";
import { reportItems, removeReportItem, type ReportItem } from "@/lib/report-items";
import { addDays, fromYmd, shortDate, ymd } from "@/lib/dates";

type RangeKey = "7" | "30" | "90" | "custom" | "appointment";

export default function ReportsPage() {
  const { profiles, activeProfile } = useHousehold();
  const repo = useRepo();
  const qc = useQueryClient();
  const t = useTranslations("reports.builder");
  const tc = useTranslations("common");
  const [profileId, setProfileId] = useState(activeProfile?.id ?? profiles[0]?.id ?? "");
  const profile = profiles.find((p) => p.id === profileId);
  const appointments = useAppointments(profileId || null);

  const today = ymd(new Date());
  const [range, setRange] = useState<RangeKey>("30");
  const [custom, setCustom] = useState({ from: ymd(addDays(new Date(), -13)), to: today });
  const [template, setTemplate] = useState<TemplateKey>("doctor");
  const [sections, setSections] = useState<SectionKey[]>(TEMPLATES.doctor.sections);
  const [questions, setQuestions] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [items, setItems] = useState<ReportItem[]>([]);
  const [appt, setAppt] = useState({ date: today, provider: "" });
  const [addingAppt, setAddingAppt] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => setQuestions(savedQuestions(profileId)), [profileId]);
  useEffect(() => setItems(reportItems()), []);

  const lastAppt = (appointments.data ?? []).filter((a) => a.date < today).at(-1);
  const nextAppt = (appointments.data ?? []).find((a) => a.date >= today);

  const { from, to } = useMemo(() => {
    if (range === "custom") return custom;
    // RPT-07: the range starts the day after the most recent appointment.
    if (range === "appointment" && lastAppt) return { from: ymd(addDays(fromYmd(lastAppt.date), 1)), to: today };
    return { from: ymd(addDays(new Date(), -(Number(range === "appointment" ? 30 : range) - 1))), to: today };
  }, [range, custom, lastAppt, today]);

  const entries = useEntries({ profileId: profileId || undefined, from: `${from}T00:00:00`, to: `${to}T23:59:59.999` }, !!profileId);

  const pickTemplate = (t: TemplateKey) => {
    setTemplate(t);
    if (t !== "custom") setSections(TEMPLATES[t].sections);
  };
  const toggle = (s: SectionKey) => {
    setSections((xs) => (xs.includes(s) ? xs.filter((x) => x !== s) : [...xs, s]));
    setTemplate("custom");
  };
  const updateQuestions = (qs: string[]) => {
    setQuestions(qs);
    saveQuestions(profileId, qs);
  };

  const csvName = (suffix: string) => `${profile?.name ?? t("fileFallback")}-${suffix}-${from}-to-${to}.csv`.toLowerCase().replace(/\s+/g, "-");
  const csv = (types?: string[]) =>
    entriesToCsv(
      (entries.data ?? []).filter((e) => !types || types.includes(e.type)),
      (id) => profiles.find((p) => p.id === id)?.name ?? "",
    );

  const exportCsv = (perModule: boolean) => {
    if (!entries.data?.length) return setMessage(t("nothing"));
    if (!perModule) {
      downloadText(csvName("all"), csv());
    } else {
      const types = [...new Set(entries.data.map((e) => e.type))];
      types.forEach((type, i) => setTimeout(() => downloadText(csvName(type), csv([type])), i * 400));
    }
    setMessage(t("exported", { count: entries.data.length }));
  };

  const share = async () => {
    const file = new File(["﻿" + csv()], csvName("all"), { type: "text/csv" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: t("shareTitle", { name: profile?.name ?? "" }) });
      } catch {
        /* cancelled */
      }
    } else {
      exportCsv(false);
      setMessage(t("shareFallback"));
    }
  };

  return (
    <>
      <AppHeader title={t("title")} />
      <div className="px-5 pt-2 pb-6 space-y-5">
        <p className="text-label font-normal text-muted-foreground -mt-2">{t("subtitle")}</p>

        <Group label={t("for")}>
          <RadioChips label={t("for")} value={profileId} onChange={setProfileId} options={profiles.map((p) => ({ value: p.id, label: p.name }))} />
        </Group>

        <Group label={t("range")} hint={t("rangeHint", { from: shortDate(fromYmd(from)), to: shortDate(fromYmd(to)), year: String(fromYmd(to).getFullYear()) })}>
          <RadioChips<RangeKey>
            label={t("range")}
            value={range}
            onChange={setRange}
            options={[
              { value: "7", label: t("days", { count: 7 }) },
              { value: "30", label: t("days", { count: 30 }) },
              { value: "90", label: t("days", { count: 90 }) },
              ...(lastAppt ? [{ value: "appointment" as const, label: t("sinceAppt") }] : []),
              { value: "custom", label: t("custom") },
            ]}
          />
          {range === "custom" && (
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-label text-muted-foreground">
                {t("from")}
                <input type="date" value={custom.from} max={custom.to} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className="h-button rounded-lg border border-input bg-card px-3 text-[16px] font-bold text-foreground" />
              </label>
              <label className="flex flex-col gap-1 text-label text-muted-foreground">
                {t("to")}
                <input type="date" value={custom.to} min={custom.from} max={today} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className="h-button rounded-lg border border-input bg-card px-3 text-[16px] font-bold text-foreground" />
              </label>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
            {lastAppt && <span>{lastAppt.provider ? t("lastApptWith", { date: shortDate(fromYmd(lastAppt.date)), provider: lastAppt.provider }) : t("lastAppt", { date: shortDate(fromYmd(lastAppt.date)) })}</span>}
            {nextAppt && <span>{nextAppt.provider ? t("nextApptWith", { date: shortDate(fromYmd(nextAppt.date)), provider: nextAppt.provider }) : t("nextAppt", { date: shortDate(fromYmd(nextAppt.date)) })}</span>}
            <button type="button" onClick={() => setAddingAppt((v) => !v)} className="min-h-touch-min inline-flex items-center gap-1 font-extrabold text-profile-ink">
              <CalendarPlus size={16} strokeWidth={2} aria-hidden="true" /> {t("addAppt")}
            </button>
          </div>
          {addingAppt && (
            <form
              className="grid grid-cols-[1fr_1.4fr_auto] gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const r = await repo.addAppointment({ profileId, date: appt.date, provider: appt.provider.trim() || null, notes: null });
                if ("error" in r) return setMessage(r.error);
                await qc.invalidateQueries({ queryKey: ["appointments"] });
                setAddingAppt(false);
              }}
            >
              <label><span className="sr-only">{t("date")}</span><input type="date" value={appt.date} onChange={(e) => setAppt({ ...appt, date: e.target.value })} className="w-full h-button rounded-lg border border-input bg-card px-2 text-[16px] font-bold" /></label>
              <label><span className="sr-only">{t("provider")}</span><input value={appt.provider} onChange={(e) => setAppt({ ...appt, provider: e.target.value })} placeholder={t("provider")} className="w-full h-button rounded-lg border border-input bg-card px-3 text-[16px] font-bold" /></label>
              <button type="submit" className="h-button px-4 rounded-full bg-primary text-primary-foreground text-body font-extrabold">{tc("add")}</button>
            </form>
          )}
        </Group>

        <Group label={t("whoFor")}>
          <RadioChips<TemplateKey> label={t("whoForLabel")} value={template} onChange={pickTemplate} options={(Object.keys(TEMPLATES) as TemplateKey[]).map((k) => ({ value: k, label: TEMPLATES[k].label }))} />
          <p className="text-caption text-muted-foreground">{TEMPLATES[template].description}</p>
        </Group>

        <Group label={t("include")}>
          <div className="rounded-card bg-card shadow-card divide-y divide-divider">
            {SECTIONS.map((s) => (
              <label key={s.key} className="flex items-center justify-between gap-3 min-h-[56px] px-4 cursor-pointer">
                <span className="text-body font-extrabold">{s.label}</span>
                <input type="checkbox" checked={sections.includes(s.key)} onChange={() => toggle(s.key)} className="switch" />
              </label>
            ))}
          </div>
        </Group>

        {items.length > 0 && (
          <Group label={t("fromInsights")}>
            <ul className="space-y-2">
              {items.map((i) => (
                <li key={i.id} className="flex items-start gap-2 p-3 rounded-lg bg-card shadow-card">
                  <Check size={16} strokeWidth={2.5} className="flex-none mt-0.5 text-profile" aria-hidden="true" />
                  <span className="flex-1 text-label font-bold">{i.title}</span>
                  <button type="button" aria-label={t("remove", { title: i.title })} onClick={() => { removeReportItem(i.id); setItems(reportItems()); }} className="w-8 h-8 flex-none rounded-full flex items-center justify-center text-muted-foreground">
                    <X size={16} strokeWidth={2} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </Group>
        )}

        {sections.includes("questions") && (
          <Group label={t("questions")}>
            <ul className="space-y-2">
              {questions.map((q, i) => (
                <li key={i} className="flex items-start gap-2 p-3 rounded-lg bg-card shadow-card">
                  <span className="flex-1 text-body">{q}</span>
                  <button type="button" aria-label={t("removeQuestion", { n: i + 1 })} onClick={() => updateQuestions(questions.filter((_, j) => j !== i))} className="w-8 h-8 flex-none rounded-full flex items-center justify-center text-muted-foreground">
                    <X size={16} strokeWidth={2} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { updateQuestions([...questions, draft.trim()]); setDraft(""); } }}>
              <label className="flex-1">
                <span className="sr-only">{t("newQuestion")}</span>
                <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={240} placeholder={t("addQuestionPlaceholder")} className="w-full h-button rounded-full border border-input bg-card px-4 text-[16px] font-bold" />
              </label>
              <button type="submit" aria-label={t("addQuestion")} className="w-[52px] h-button flex-none rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                <Plus size={20} strokeWidth={2} aria-hidden="true" />
              </button>
            </form>
          </Group>
        )}

        <div className="space-y-2.5 pt-1">
          <Link
            href={reportHref({ profileId, from, to, template, sections })}
            className="w-full h-button flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground text-body-lg"
          >
            <FileText size={20} strokeWidth={2} aria-hidden="true" /> {t("preview")}
          </Link>
          <div className="grid grid-cols-2 gap-2.5">
            <button type="button" onClick={() => exportCsv(false)} className="h-button flex items-center justify-center gap-2 rounded-full border-[1.5px] border-border-strong bg-card text-body-md">
              <Download size={18} strokeWidth={2} aria-hidden="true" /> {t("exportCsv")}
            </button>
            <button type="button" onClick={() => void share()} className="h-button flex items-center justify-center gap-2 rounded-full border-[1.5px] border-border-strong bg-card text-body-md">
              <Share2 size={18} strokeWidth={2} aria-hidden="true" /> {t("share")}
            </button>
          </div>
          <button type="button" onClick={() => exportCsv(true)} className="w-full min-h-touch-min text-label font-extrabold text-profile-ink">
            {t("perModule")}
          </button>
          {message && <p role="status" className="text-caption font-bold text-foreground-2 text-center">{message}</p>}
        </div>
      </div>
    </>
  );
}
