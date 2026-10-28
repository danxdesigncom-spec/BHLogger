import { Suspense } from "react";
import { TimelineClient } from "./TimelineClient";

export const metadata = { title: "Timeline" };

export default function TimelinePage() {
  return (
    <Suspense>
      <TimelineClient />
    </Suspense>
  );
}
