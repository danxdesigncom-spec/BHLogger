"use client";

import { useCallback, useEffect, useState } from "react";

// QL-08: a dismissed banner or prompt doesn't come back for the same event. Kept per device.
const STORAGE_KEY = "bl-dismissed-banners";

export function readDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function useDismissals() {
  const [dismissed, setDismissed] = useState<string[]>([]);
  useEffect(() => setDismissed(readDismissed()), []);
  const dismiss = useCallback((key: string) => {
    setDismissed((prev) => {
      const next = [...prev, key].slice(-200);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable: dismissal lasts this session */
      }
      return next;
    });
  }, []);
  return { dismissed, dismiss };
}

/** Re-renders on an interval, for prompts that appear at a time of day or some minutes after an event. */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
