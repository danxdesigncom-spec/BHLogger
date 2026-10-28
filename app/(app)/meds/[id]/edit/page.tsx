"use client";

import { use } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useTranslations } from "next-intl";
import { MedicationForm } from "@/components/meds/MedicationForm";
import { useHousehold } from "@/lib/context/household-provider";
import { useMedications } from "@/lib/data/hooks";

export default function EditMedicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { activeProfile } = useHousehold();
  const t = useTranslations();
  const meds = useMedications(activeProfile?.id ?? null);
  const med = meds.data?.find((m) => m.id === id);

  return (
    <>
      <PageHeader title={med ? t("meds.editTitle", { name: med.name }) : t("meds.editFallback")} subtitle={t("common.for", { name: activeProfile?.name ?? "" })} backHref={`/meds/${id}`} />
      {meds.isLoading ? (
        <p className="px-5 pt-4 text-body text-muted-foreground">{t("common.loading")}</p>
      ) : med ? (
        <MedicationForm existing={med} />
      ) : (
        <p className="px-5 pt-4 text-body text-muted-foreground">{t("meds.otherProfile")}</p>
      )}
    </>
  );
}
