"use client";

import { useState, type ReactNode } from "react";
import { Table2, BarChart3 } from "lucide-react";
import { useTranslations } from "next-intl";
import { chartItemId } from "@/lib/report-items";
import { AddToReportButton } from "./AddToReportButton";

export interface TableData {
  columns: string[];
  rows: (string | number)[][];
}

/** DESIGN 6: kicker, headline sentence, chart (role="img"), caption, "View as table" (DSH-11), "Add to report" (DSH-12). */
export function ChartCard({
  kicker, icon, inkClass, headline, caption, table, children, footer, ariaRange, reportId,
}: {
  kicker: string;
  icon?: ReactNode;
  inkClass?: string;
  headline: string;
  caption?: ReactNode;
  table?: TableData;
  children: ReactNode;
  footer?: ReactNode;
  ariaRange?: string;
  /** Card id for "Add to report"; the report draws the same chart for its own date range. */
  reportId?: string;
}) {
  const [asTable, setAsTable] = useState(false);
  const t = useTranslations("chart");
  return (
    <section className="rounded-card bg-card shadow-card p-4 space-y-3 break-inside-avoid" aria-label={`${kicker}: ${headline}`}>
      <div className="space-y-1">
        <p className={`flex items-center gap-1.5 text-label font-extrabold ${inkClass ?? "text-muted-foreground"} [&_svg]:w-4 [&_svg]:h-4`}>
          {icon}
          {kicker}
        </p>
        <h2 className="font-display text-title-4">{headline}</h2>
      </div>
      {asTable && table ? (
        <div className="overflow-x-auto">
          <table className="w-full text-label tabular-nums">
            <thead>
              <tr>{table.columns.map((c) => <th key={c} scope="col" className="text-left font-extrabold text-muted-foreground py-1.5 pr-3">{c}</th>)}</tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i} className="border-t border-divider">
                  {r.map((v, j) => (j === 0 ? <th key={j} scope="row" className="text-left font-bold py-1.5 pr-3">{v}</th> : <td key={j} className="py-1.5 pr-3">{v}</td>))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div role="img" aria-label={`${headline}${ariaRange ? `. ${ariaRange}` : ""}`}>{children}</div>
      )}
      {caption && reportId && <p className="text-caption text-muted-foreground">{caption}</p>}
      {(caption || table || reportId) && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          {caption && !reportId ? <p className="text-caption text-muted-foreground">{caption}</p> : null}
          {table ? (
            <button type="button" aria-pressed={asTable} onClick={() => setAsTable((v) => !v)} className="min-h-touch-min flex-none flex items-center gap-1.5 px-1 text-label font-extrabold text-profile-ink">
              {asTable ? <BarChart3 size={16} strokeWidth={2} aria-hidden="true" /> : <Table2 size={16} strokeWidth={2} aria-hidden="true" />}
              {asTable ? t("viewChart") : t("viewTable")}
            </button>
          ) : <span />}
          {reportId && <AddToReportButton id={chartItemId(reportId)} kind="chart" title={kicker} detail={headline} />}
        </div>
      )}
      {footer}
    </section>
  );
}
