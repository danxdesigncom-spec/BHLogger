import { Suspense } from "react";
import { TrendsClient } from "./TrendsClient";

export default function TrendsPage() {
  return (
    <Suspense>
      <TrendsClient />
    </Suspense>
  );
}
