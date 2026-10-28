import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { TimelineClient } from "./TimelineClient";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("timeline") };
}

export default function TimelinePage() {
  return (
    <Suspense>
      <TimelineClient />
    </Suspense>
  );
}
