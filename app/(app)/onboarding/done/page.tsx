import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Sparkles, Plus } from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("onboarding");
  return { title: t("metaDone") };
}

export default async function OnboardingDonePage({
  searchParams,
}: {
  searchParams: Promise<{ profileId?: string }>;
}) {
  const params = await searchParams;
  if (!params.profileId) redirect("/onboarding/profile");

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, color")
    .eq("id", params.profileId)
    .single();

  if (!profile) redirect("/onboarding/profile");
  const t = await getTranslations("onboarding");
  const tips = t.raw("tips") as string[];

  return (
    <div className="flex flex-col flex-1 px-5 pt-14 pb-7">
      {/* Progress (step 3 = done) */}
      <div className="space-y-2 mb-8">
        <span className="text-caption font-extrabold text-muted-foreground">{t("stepOf", { step: 3, total: 3 })}</span>
        <div
          role="progressbar"
          aria-label={t("progress")}
          aria-valuemin={1}
          aria-valuemax={3}
          aria-valuenow={3}
          className="h-2 rounded-full bg-secondary"
        >
          <div className="h-2 w-full rounded-full bg-profile" />
        </div>
      </div>

      <div className="flex flex-col items-center text-center gap-4 mb-10">
        <div className="w-16 h-16 rounded-full bg-profile-tint flex items-center justify-center">
          <Sparkles size={28} strokeWidth={2} className="text-profile-ink" aria-hidden="true" />
        </div>
        <h1 className="font-display text-display-2">
          {t("doneTitle")}
        </h1>
        <p className="text-body font-normal text-muted-foreground">
          {t("doneBody", { name: profile.name })}
        </p>
      </div>

      {/* Tips */}
      <ul className="space-y-3 mb-10">
        {tips.map((tip) => (
          <li key={tip} className="flex items-start gap-3">
            <span className="w-5 h-5 mt-0.5 flex-none rounded-full bg-profile text-on-profile flex items-center justify-center">
              <svg viewBox="0 0 16 16" fill="none" className="w-3 h-3" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 8.5l3 3L13 5" />
              </svg>
            </span>
            <span className="text-label font-bold">{tip}</span>
          </li>
        ))}
      </ul>

      {/* Optional actions */}
      <div className="space-y-3">
        <Link
          href="/more/caregivers/invite"
          className="w-full h-button flex items-center justify-center gap-2 rounded-full border-[1.5px] border-border-strong bg-card text-body-md text-foreground"
        >
          <Plus size={18} strokeWidth={2} aria-hidden="true" />
          {t("invite")}
        </Link>
      </div>

      <div className="flex-1" />

      <Link
        href="/"
        className="w-full h-button flex items-center justify-center rounded-full bg-primary text-primary-foreground text-body-lg mt-4"
      >
        {t("skip")}
      </Link>
    </div>
  );
}
