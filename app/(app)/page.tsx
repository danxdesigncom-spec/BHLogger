import type { Metadata } from "next";
import { HomeClient } from "./HomeClient";

export const metadata: Metadata = { title: "Log" };

export default function HomePage() {
  return <HomeClient />;
}
