import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AcceptInviteForm } from "./AcceptInviteForm";

export const metadata: Metadata = { title: "You've been invited" };

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

  // get_invite_preview is SECURITY DEFINER — callable without auth
  const { data: preview } = await supabase.rpc("get_invite_preview", {
    p_token: token,
  });

  if (!preview) {
    return <InviteErrorPage title="This invite isn't valid" body="The link may be incomplete or already used." />;
  }

  if (preview.status === "expired") {
    return (
      <InviteErrorPage
        title="This invite has expired"
        body="Ask the household admin to send a new one."
      />
    );
  }

  if (preview.status === "accepted") {
    return (
      <InviteErrorPage
        title="This invite has already been accepted"
        body="Sign in if you haven't already."
        showSignIn
      />
    );
  }

  const profiles = (preview.profiles as InviteProfile[] | null) ?? [];
  const profileNames = profiles.map((p) => p.name);
  const namesStr = listFormatter(profileNames);

  const expiresDate = new Date(preview.expires_at).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const roleCapabilities: Record<string, string[]> = {
    caregiver: [
      "Log bathroom, eating, activity, mood and medications",
      "See insights and the timeline",
      "Edit your own entries",
    ],
    admin: [
      "Everything a caregiver can do",
      "Invite and remove caregivers",
      "Manage profiles and settings",
    ],
    viewer: [
      "See the timeline and insights",
      "Export and print reports",
      "Can't add or edit entries",
    ],
  };

  const capabilities = roleCapabilities[preview.role] ?? roleCapabilities.caregiver;
  const roleLabel = preview.role.charAt(0).toUpperCase() + preview.role.slice(1);

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
        roleLabel={roleLabel}
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
      roleLabel={roleLabel}
      capabilities={capabilities}
      expiresDate={expiresDate}
      alreadySignedIn={false}
    />
  );
}

function InviteErrorPage({
  title,
  body,
  showSignIn = false,
}: {
  title: string;
  body: string;
  showSignIn?: boolean;
}) {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-5 bg-[var(--color-card)]">
      <div className="w-full max-w-sm space-y-4 text-center">
        <h1 className="font-display text-[28px] font-semibold leading-tight">{title}</h1>
        <p className="text-muted-foreground text-sm">{body}</p>
        {showSignIn && (
          <Link
            href="/auth/login"
            className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-foreground text-background px-8 text-[17px] font-extrabold"
          >
            Sign in
          </Link>
        )}
      </div>
    </main>
  );
}

function listFormatter(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}
