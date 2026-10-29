"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False while rendering on the server and hydrating, true afterwards. Use it for text worked out from the
 * viewer's own clock or time zone (date ranges, ages, "today"): the server's date can already be tomorrow,
 * and rendering it there makes hydration fail.
 */
export function useOnClient(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
