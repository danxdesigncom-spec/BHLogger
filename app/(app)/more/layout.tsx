import { getTranslations } from "next-intl/server";
export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("more") };
}

export default function MoreLayout({ children }: { children: React.ReactNode }) {
  return children;
}
