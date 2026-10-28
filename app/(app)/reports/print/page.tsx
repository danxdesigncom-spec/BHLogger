import { Suspense } from "react";
import { ReportDocument } from "./ReportDocument";

export default function ReportPrintPage() {
  return (
    <Suspense>
      <ReportDocument />
    </Suspense>
  );
}
