import Link from "next/link";
import { CloudOff } from "lucide-react";

export const metadata = { title: "Offline" };
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="w-16 h-16 rounded-full bg-info text-info-ink flex items-center justify-center">
        <CloudOff size={30} strokeWidth={2} aria-hidden="true" />
      </span>
      <h1 className="font-display text-title-1">You&rsquo;re offline</h1>
      <p className="max-w-xs text-body text-muted-foreground">
        This page hasn&rsquo;t been opened on this device yet. Go back to Log; anything you save there syncs when you&rsquo;re back online.
      </p>
      <Link href="/" className="h-button px-6 flex items-center rounded-full bg-primary text-primary-foreground text-body-lg">Back to Log</Link>
    </main>
  );
}
