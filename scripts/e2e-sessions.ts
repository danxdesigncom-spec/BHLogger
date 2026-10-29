/**
 * Signed-in browser sessions for the live Playwright specs (AT-02 across two devices, AT-08 offline,
 * the invite flow). Run against a project that has the seed story loaded (`pnpm db:seed`), never the pilot:
 *
 *   pnpm e2e:sessions
 *   E2E_STORAGE_STATE=tests/.auth/mom.json E2E_STORAGE_STATE_2=tests/.auth/dad.json pnpm test:e2e
 *
 * It asks Supabase for a magic link for each seed user with the service-role key (no email is sent and
 * no password is used), verifies it the way the app's server does, and saves the resulting cookies as a
 * Playwright storage state in tests/.auth/ (gitignored). Sessions refresh themselves for about a week.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_URL = new URL(process.env.BASE_URL ?? "http://localhost:3000");
const PEOPLE = { mom: "mom@rodriguez.example", dad: "dad@rodriguez.example" };

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY (in .env.local).");
  process.exit(1);
}

const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
mkdirSync("tests/.auth", { recursive: true });

for (const [who, email] of Object.entries(PEOPLE)) {
  const { data, error } = await service.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) throw new Error(`No sign-in link for ${email}: ${error?.message}`);

  // The same cookie handling as lib/supabase/server.ts, kept in memory.
  const jar = new Map<string, string>();
  const client = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies: { name: string; value: string }[]) => cookies.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
    },
  });
  const { error: verifyError } = await client.auth.verifyOtp({ type: "magiclink", token_hash: data.properties.hashed_token });
  if (verifyError) throw new Error(`Couldn't sign in ${email}: ${verifyError.message}`);

  const expires = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
  const state = {
    cookies: [...jar].map(([name, value]) => ({ name, value, domain: BASE_URL.hostname, path: "/", expires, httpOnly: false, secure: BASE_URL.protocol === "https:", sameSite: "Lax" as const })),
    origins: [],
  };
  writeFileSync(`tests/.auth/${who}.json`, JSON.stringify(state, null, 2));
  console.log(`tests/.auth/${who}.json  (${email})`);
}
