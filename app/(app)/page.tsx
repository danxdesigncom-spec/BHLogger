import type { Metadata } from "next";
import { Suspense } from "react";
import { HomeClient } from "./HomeClient";

export const metadata: Metadata = { title: "Log" };

export default function HomePage() {
  return (
    <Suspense>
      <HomeClient />
    </Suspense>
  );
}
