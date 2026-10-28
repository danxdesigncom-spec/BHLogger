import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { AcceptInviteForm } from "./AcceptInviteForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("invite");
  return { title: t("metaTitle") };
}

interface InviteProfile {
  id: string;
  name: string;
  color: string;
}

export default async function JoinInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const t = await getTranslations("invite");
  const locale = await getLocale();

  // get_invite_preview is SECURITY DEFINER — callable without auth
  const { data: preview } = await supabase.rpc("get_invite_preview", {
    p_token: token,
  });

  if (!preview) {
    return <InviteErrorPage title={t("invalidTitle")} body={t("invalidBody")} />;
  }

  if (preview.status === "expired") {
    return (
      <InviteErrorPage
        title={t("expiredTitle")}
        body={t("expiredBody")}
      />
    );
  }

  if (preview.status === "accepted") {
    return (
      <InviteErrorPage
        title={t("acceptedTitle")}
        body={t("acceptedBody")}
        signInLabel={t("signIn")}
      />
    );
  }

  const profiles = (preview.profiles as InviteProfile[] | null) ?? [];
  const profileNames = profiles.map((p) => p.name);
  const namesStr = new Intl.ListFormat(locale, { type: "conjunction" }).format(profileNames);

  const expiresDate = new Date(preview.expires_at).toLocaleDateString(locale, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const role = ["caregiver", "admin", "viewer"].includes(preview.role) ? preview.role : "caregiver";
  const capabilities = t.raw(`capabilities.${role}`) as string[];

  // Check if already signed in
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // Signed in — accept immediately via the form
    return (
      <AcceptInviteForm
        token={token}
        inviterName={preview.inviter_name}
        profiles={profiles}
        namesStr={namesStr}
        role={role}
        capabilities={capabilities}
        expiresDate={expiresDate}
        alreadySignedIn
      />
    );
  }

  return (
    <AcceptInviteForm
      token={token}
      inviterName={preview.inviter_name}
      profiles={profiles}
      namesStr={namesStr}
      role={role}
      capabilities={capabilities}
      expiresDate={expiresDate}
      alreadySignedIn={false}
    />
  );
}

function InviteErrorPage({
  title,
  body,
  signInLabel,
}: {
  title: string;
  body: string;
  signInLabel?: string;
}) {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-5">
      <div className="w-full max-w-sm space-y-4 text-center">
        <h1 className="font-display text-title-1">{title}</h1>
        <p className="text-body font-normal text-muted-foreground">{body}</p>
        {signInLabel && (
          <Link
            href="/auth/login"
            className="inline-flex h-button items-center justify-center rounded-full bg-primary text-primary-foreground px-8 text-body-lg"
          >
            {signInLabel}
          </Link>
        )}
      </div>
    </main>
  );
}
