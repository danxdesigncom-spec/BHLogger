"use client";

import { useEffect, useState } from "react";
import { Share, SquarePlus, X } from "lucide-react";
import { isIosSafari, isStandalone, loggingSessions } from "@/lib/install";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED = "bl-install-dismissed";

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [mode, setMode] = useState<"hidden" | "native" | "ios">("hidden");

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISSED) === "1";
    } catch {
      /* storage unavailable */
    }
    if (dismissed || isStandalone() || loggingSessions() < 3) return;
    if (isIosSafari()) setMode("ios");
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setMode("native");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (mode === "hidden") return null;

  const dismiss = () => {
    setMode("hidden");
    try {
      localStorage.setItem(DISMISSED, "1");
    } catch {
      /* storage unavailable */
    }
  };

  return (
    <section aria-label="Add to Home Screen" className="flex items-start gap-3 p-3.5 rounded-card bg-card shadow-card">
      <span className="w-12 h-12 flex-none rounded-lg bg-profile-tint text-profile-ink flex items-center justify-center">
        <SquarePlus size={24} strokeWidth={2} aria-hidden="true" />
      </span>
      <span className="flex-1 min-w-0 flex flex-col gap-1">
        <span className="text-body-md">Add Behavior Logger to your Home Screen</span>
        {mode === "ios" ? (
          <span className="text-label font-normal text-muted-foreground">
            Tap <Share size={14} strokeWidth={2} className="inline -mt-0.5" aria-label="Share" /> then &ldquo;Add to Home Screen&rdquo;. It opens faster, works offline, and keeps this phone&rsquo;s logs safe.
          </span>
        ) : (
          <span className="text-label font-normal text-muted-foreground">It opens like an app and works offline.</span>
        )}
        {mode === "native" && deferred && (
          <button
            type="button"
            onClick={async () => {
              await deferred.prompt();
              await deferred.userChoice;
              setMode("hidden");
            }}
            className="self-start mt-1 min-h-touch-min px-[18px] rounded-full bg-primary text-primary-foreground text-body-md"
          >
            Install
          </button>
        )}
      </span>
      <button type="button" aria-label="Not now" onClick={dismiss} className="w-11 h-11 -mr-1.5 -mt-1.5 flex-none rounded-full flex items-center justify-center text-muted-foreground">
        <X size={18} strokeWidth={2} aria-hidden="true" />
      </button>
    </section>
  );
}
