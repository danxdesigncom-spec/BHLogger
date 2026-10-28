"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { MedicationForm } from "@/components/meds/MedicationForm";
import { useHousehold } from "@/lib/context/household-provider";

export default function NewMedicationPage() {
  const { activeProfile } = useHousehold();
  return (
    <>
      <PageHeader title="Add medication" subtitle={`for ${activeProfile?.name ?? ""}`} backHref="/meds" backLabel="Back to Medications" />
      <MedicationForm />
    </>
  );
}
