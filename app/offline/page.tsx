import Link from "next/link";
import { CloudOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
  const t = await getTranslations("offline");
  return { title: t("metaTitle") };
}
export const dynamic = "force-static";

export default function OfflinePage() {
  const t = useTranslations("offline");
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="w-16 h-16 rounded-full bg-info text-info-ink flex items-center justify-center">
        <CloudOff size={30} strokeWidth={2} aria-hidden="true" />
      </span>
      <h1 className="font-display text-title-1">{t("title")}</h1>
      <p className="max-w-xs text-body text-muted-foreground">
        {t("body")}
      </p>
      <Link href="/" className="h-button px-6 flex items-center rounded-full bg-primary text-primary-foreground text-body-lg">{t("back")}</Link>
    </main>
  );
}
