// Demo mode: explore the app without an account. "Continue without saving" on the login screen
// sets the bl-demo cookie; data lives in this browser's IndexedDB (lib/data/demo-repo.ts).

// Never available in production builds unless explicitly opted in.
export const DEMO_ENABLED =
  process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_ENABLE_DEMO === "1";

export const DEMO_COOKIE = "bl-demo";
export const DEMO_COOKIE_VALUE = "1";
