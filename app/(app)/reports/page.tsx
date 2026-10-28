"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Check, Download, FileText, Plus, Share2, X } from "lucide-react";
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

  const csvName = (suffix: string) => `${profile?.name ?? "report"}-${suffix}-${from}-to-${to}.csv`.toLowerCase().replace(/\s+/g, "-");
  const csv = (types?: string[]) =>
    entriesToCsv(
      (entries.data ?? []).filter((e) => !types || types.includes(e.type)),
      (id) => profiles.find((p) => p.id === id)?.name ?? "",
    );

  const exportCsv = (perModule: boolean) => {
    if (!entries.data?.length) return setMessage("Nothing logged in this range.");
    if (!perModule) {
      downloadText(csvName("all"), csv());
    } else {
      const types = [...new Set(entries.data.map((e) => e.type))];
      types.forEach((t, i) => setTimeout(() => downloadText(csvName(t), csv([t])), i * 400));
    }
    setMessage(`Exported ${entries.data.length} entries.`);
  };

  const share = async () => {
    const file = new File(["﻿" + csv()], csvName("all"), { type: "text/csv" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `${profile?.name}'s care log` });
      } catch {
        /* cancelled */
      }
    } else {
      exportCsv(false);
      setMessage("Sharing files isn't supported here, so the CSV was downloaded instead.");
    }
  };

  return (
    <>
      <AppHeader title="Reports" />
      <div className="px-5 pt-2 pb-6 space-y-5">
        <p className="text-label font-normal text-muted-foreground -mt-2">For doctors, therapists and school teams</p>

        <Group label="For">
          <RadioChips label="For" value={profileId} onChange={setProfileId} options={profiles.map((p) => ({ value: p.id, label: p.name }))} />
        </Group>

        <Group label="Date range" hint={`${shortDate(fromYmd(from))} to ${shortDate(fromYmd(to))}, ${fromYmd(to).getFullYear()}`}>
          <RadioChips<RangeKey>
            label="Date range"
            value={range}
            onChange={setRange}
            options={[
              { value: "7", label: "7 days" },
              { value: "30", label: "30 days" },
              { value: "90", label: "90 days" },
              ...(lastAppt ? [{ value: "appointment" as const, label: "Since last appointment" }] : []),
              { value: "custom", label: "Custom" },
            ]}
          />
          {range === "custom" && (
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-label text-muted-foreground">
                From
                <input type="date" value={custom.from} max={custom.to} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className="h-button rounded-lg border border-input bg-card px-3 text-[16px] font-bold text-foreground" />
              </label>
              <label className="flex flex-col gap-1 text-label text-muted-foreground">
                To
                <input type="date" value={custom.to} min={custom.from} max={today} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className="h-button rounded-lg border border-input bg-card px-3 text-[16px] font-bold text-foreground" />
              </label>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
            {lastAppt && <span>Last appointment {shortDate(fromYmd(lastAppt.date))}{lastAppt.provider ? `, ${lastAppt.provider}` : ""}.</span>}
            {nextAppt && <span>Next {shortDate(fromYmd(nextAppt.date))}{nextAppt.provider ? `, ${nextAppt.provider}` : ""}.</span>}
            <button type="button" onClick={() => setAddingAppt((v) => !v)} className="min-h-touch-min inline-flex items-center gap-1 font-extrabold text-profile-ink">
              <CalendarPlus size={16} strokeWidth={2} aria-hidden="true" /> Add an appointment
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
              <label><span className="sr-only">Date</span><input type="date" value={appt.date} onChange={(e) => setAppt({ ...appt, date: e.target.value })} className="w-full h-button rounded-lg border border-input bg-card px-2 text-[16px] font-bold" /></label>
              <label><span className="sr-only">Provider</span><input value={appt.provider} onChange={(e) => setAppt({ ...appt, provider: e.target.value })} placeholder="Provider" className="w-full h-button rounded-lg border border-input bg-card px-3 text-[16px] font-bold" /></label>
              <button type="submit" className="h-button px-4 rounded-full bg-primary text-primary-foreground text-body font-extrabold">Add</button>
            </form>
          )}
        </Group>

        <Group label="Who is it for?">
          <RadioChips<TemplateKey> label="Who is it for" value={template} onChange={pickTemplate} options={(Object.keys(TEMPLATES) as TemplateKey[]).map((t) => ({ value: t, label: TEMPLATES[t].label }))} />
          <p className="text-caption text-muted-foreground">{TEMPLATES[template].description}</p>
        </Group>

        <Group label="Include">
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
          <Group label="Added from Insights">
            <ul className="space-y-2">
              {items.map((i) => (
                <li key={i.id} className="flex items-start gap-2 p-3 rounded-lg bg-card shadow-card">
                  <Check size={16} strokeWidth={2.5} className="flex-none mt-0.5 text-profile" aria-hidden="true" />
                  <span className="flex-1 text-label font-bold">{i.title}</span>
                  <button type="button" aria-label={`Remove ${i.title}`} onClick={() => { removeReportItem(i.id); setItems(reportItems()); }} className="w-8 h-8 flex-none rounded-full flex items-center justify-center text-muted-foreground">
                    <X size={16} strokeWidth={2} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </Group>
        )}

        {sections.includes("questions") && (
          <Group label="Questions for this visit">
            <ul className="space-y-2">
              {questions.map((q, i) => (
                <li key={i} className="flex items-start gap-2 p-3 rounded-lg bg-card shadow-card">
                  <span className="flex-1 text-body">{q}</span>
                  <button type="button" aria-label={`Remove question ${i + 1}`} onClick={() => updateQuestions(questions.filter((_, j) => j !== i))} className="w-8 h-8 flex-none rounded-full flex items-center justify-center text-muted-foreground">
                    <X size={16} strokeWidth={2} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { updateQuestions([...questions, draft.trim()]); setDraft(""); } }}>
              <label className="flex-1">
                <span className="sr-only">New question</span>
                <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={240} placeholder="Add a question" className="w-full h-button rounded-full border border-input bg-card px-4 text-[16px] font-bold" />
              </label>
              <button type="submit" aria-label="Add question" className="w-[52px] h-button flex-none rounded-full bg-primary text-primary-foreground flex items-center justify-center">
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
            <FileText size={20} strokeWidth={2} aria-hidden="true" /> Preview PDF
          </Link>
          <div className="grid grid-cols-2 gap-2.5">
            <button type="button" onClick={() => exportCsv(false)} className="h-button flex items-center justify-center gap-2 rounded-full border-[1.5px] border-border-strong bg-card text-body-md">
              <Download size={18} strokeWidth={2} aria-hidden="true" /> Export CSV
            </button>
            <button type="button" onClick={() => void share()} className="h-button flex items-center justify-center gap-2 rounded-full border-[1.5px] border-border-strong bg-card text-body-md">
              <Share2 size={18} strokeWidth={2} aria-hidden="true" /> Share
            </button>
          </div>
          <button type="button" onClick={() => exportCsv(true)} className="w-full min-h-touch-min text-label font-extrabold text-profile-ink">
            Export one CSV per module
          </button>
          {message && <p role="status" className="text-caption font-bold text-foreground-2 text-center">{message}</p>}
        </div>
      </div>
    </>
  );
}
