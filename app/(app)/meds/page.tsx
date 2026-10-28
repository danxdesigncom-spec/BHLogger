import { Suspense } from "react";
import { MedicationsClient } from "./MedicationsClient";

export const metadata = { title: "Medications" };

export default function MedicationsPage() {
  return (
    <Suspense>
      <MedicationsClient />
    </Suspense>
  );
}
