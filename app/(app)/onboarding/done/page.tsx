import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Sparkles, Plus } from "lucide-react";

export const metadata: Metadata = { title: "You're set up!" };

const TIPS = [
  "Logging takes 3 taps or fewer",
  "Data syncs across all caregivers in real time",
  "You can add medications anytime from the More tab",
];

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

  return (
    <div className="flex flex-col flex-1 px-5 pt-14 pb-7">
      {/* Progress (step 3 = done) */}
      <div className="space-y-2 mb-8">
        <span className="text-[13px] font-extrabold text-muted-foreground">Step 3 of 3</span>
        <div
          role="progressbar"
          aria-label="Setup progress"
          aria-valuemin={1}
          aria-valuemax={3}
          aria-valuenow={3}
          className="h-2 rounded-full bg-[var(--color-border)]"
        >
          <div className="h-2 w-full rounded-full bg-[var(--color-profile)]" />
        </div>
      </div>

      <div className="flex flex-col items-center text-center gap-4 mb-10">
        <div className="w-16 h-16 rounded-full bg-[var(--color-profile-bg)] flex items-center justify-center">
          <Sparkles size={28} strokeWidth={2} className="text-[var(--color-profile)]" />
        </div>
        <h1 className="font-display text-[30px] font-semibold leading-tight">
          You&rsquo;re all set!
        </h1>
        <p className="text-sm text-muted-foreground">
          {profile.name}&rsquo;s care record is ready.
        </p>
      </div>

      {/* Tips */}
      <ul className="space-y-3 mb-10">
        {TIPS.map((tip) => (
          <li key={tip} className="flex items-start gap-3">
            <span className="w-5 h-5 mt-0.5 flex-none rounded-full bg-[var(--color-profile)] flex items-center justify-center">
              <svg viewBox="0 0 16 16" fill="none" className="w-3 h-3 text-white" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 8.5l3 3L13 5" />
              </svg>
            </span>
            <span className="text-sm font-bold leading-snug">{tip}</span>
          </li>
        ))}
      </ul>

      {/* Optional actions */}
      <div className="space-y-3">
        <Link
          href="/more/caregivers/invite"
          className="w-full min-h-[52px] flex items-center justify-center gap-2 rounded-full border-[1.5px] border-[var(--color-border)] bg-white text-[15px] font-extrabold text-foreground"
        >
          <Plus size={18} strokeWidth={2} />
          Invite a caregiver
        </Link>
      </div>

      <div className="flex-1" />

      <Link
        href="/"
        className="w-full min-h-[52px] flex items-center justify-center rounded-full bg-foreground text-background text-[17px] font-extrabold mt-4"
      >
        Skip and start logging
      </Link>
    </div>
  );
}
