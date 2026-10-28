import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, NetworkFirst, NetworkOnly, Serwist, StaleWhileRevalidate } from "serwist";

declare global {
  interface ServiceWorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Health data never goes into Cache Storage. Supabase calls go straight to the network;
    // the app keeps its own offline copy in IndexedDB (lib/data/outbox.ts).
    { matcher: ({ url }) => url.hostname.endsWith(".supabase.co"), handler: new NetworkOnly() },
    // Server actions (POST) are never cached.
    { matcher: ({ request }) => request.method !== "GET", handler: new NetworkOnly() },
    // App shell: pages and the RSC payloads used for in-app navigation, so the app opens offline.
    {
      matcher: ({ request, url }) => request.headers.get("RSC") === "1" || url.searchParams.has("_rsc"),
      handler: new NetworkFirst({ cacheName: "rsc", networkTimeoutSeconds: 4 }),
    },
    {
      matcher: ({ request }) => request.mode === "navigate",
      handler: new NetworkFirst({ cacheName: "pages", networkTimeoutSeconds: 4 }),
    },
    {
      matcher: ({ request }) => ["style", "script", "worker"].includes(request.destination),
      handler: new StaleWhileRevalidate({ cacheName: "static-assets" }),
    },
    {
      matcher: ({ request }) => request.destination === "font" || request.destination === "image",
      handler: new CacheFirst({ cacheName: "media" }),
    },
  ],
  fallbacks: {
    entries: [{ url: "/offline", matcher: ({ request }) => request.destination === "document" }],
  },
});

serwist.addEventListeners();
