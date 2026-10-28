import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "./LoginForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("metaTitle") };
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const t = useTranslations();
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
        <LoginForm searchParams={searchParams} />
      </div>
    </main>
  );
}
