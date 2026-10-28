"use client";

import { use } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MedicationForm } from "@/components/meds/MedicationForm";
import { useHousehold } from "@/lib/context/household-provider";
import { useMedications } from "@/lib/data/hooks";

export default function EditMedicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { activeProfile } = useHousehold();
  const meds = useMedications(activeProfile?.id ?? null);
  const med = meds.data?.find((m) => m.id === id);

  return (
    <>
      <PageHeader title={med ? `Edit ${med.name}` : "Edit medication"} subtitle={`for ${activeProfile?.name ?? ""}`} backHref={`/meds/${id}`} backLabel="Back" />
      {meds.isLoading ? (
        <p className="px-5 pt-4 text-body text-muted-foreground">Loading…</p>
      ) : med ? (
        <MedicationForm existing={med} />
      ) : (
        <p className="px-5 pt-4 text-body text-muted-foreground">This medication belongs to another profile. Switch profiles to edit it.</p>
      )}
    </>
  );
}
