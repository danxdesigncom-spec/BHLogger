import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { MedicationsClient } from "./MedicationsClient";

export async function generateMetadata() {
  const t = await getTranslations("meta");
  return { title: t("medications") };
}

export default function MedicationsPage() {
  return (
    <Suspense>
      <MedicationsClient />
    </Suspense>
  );
}
