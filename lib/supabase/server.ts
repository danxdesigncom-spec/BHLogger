import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export async function createClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies();

  // Cast needed: @supabase/ssr v0.6.1 returns SupabaseClient with mismatched
  // type-parameter arity vs supabase-js v2.x, collapsing Schema to never.
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options?: object }[],
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server component — cookies set by middleware; ignore.
          }
        },
      },
    },
  ) as unknown as SupabaseClient<Database>;
}
