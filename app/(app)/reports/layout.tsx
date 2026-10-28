import { getTranslations } from "next-intl/server";
export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("reports") };
}

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
