import { Suspense } from "react";
import { MedicationsClient } from "./MedicationsClient";

export const metadata = { title: "Medications · Behavior Logger" };

export default function MedicationsPage() {
  return (
    <Suspense>
      <MedicationsClient />
    </Suspense>
  );
}
