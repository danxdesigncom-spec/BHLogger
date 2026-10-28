"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { useTranslations } from "next-intl";
import { MedicationForm } from "@/components/meds/MedicationForm";
import { useHousehold } from "@/lib/context/household-provider";

export default function NewMedicationPage() {
  const { activeProfile } = useHousehold();
  const t = useTranslations();
  return (
    <>
      <PageHeader title={t("meds.add")} subtitle={t("common.for", { name: activeProfile?.name ?? "" })} backHref="/meds" backLabel={t("meds.detail.backToMeds")} />
      <MedicationForm />
    </>
  );
}
