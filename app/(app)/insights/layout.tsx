import { getTranslations } from "next-intl/server";
export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("insights") };
}

export default function InsightsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
