import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "./LoginForm";
import { safeNext } from "@/lib/auth/safe-next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("metaTitle") };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; deleted?: string }>;
}) {
  // Resolve the params here and pass plain strings: handing the promise to a client component makes
  // Next.js warn about synchronous access when React serializes it.
  const { error, next, deleted } = await searchParams;
  const t = await getTranslations();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-1 text-center">
          <h1 className="font-display text-display-2">
            {t("app.name")}
          </h1>
          <p className="text-label font-normal text-muted-foreground">
            {t("auth.subtitle")}
          </p>
        </div>
        {deleted === "1" && (
          <p role="status" className="rounded-card bg-card p-4 shadow-card text-center text-body font-bold">
            {t("auth.accountDeleted")}
          </p>
        )}
        <LoginForm next={safeNext(next)} callbackError={typeof error === "string" ? error : undefined} />
      </div>
    </main>
  );
}
