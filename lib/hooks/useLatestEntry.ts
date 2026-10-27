"use client";

import { useQuery } from "@tanstack/react-query";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/types";

function getSupabase() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export function useLatestEntry(profileId: string | null, module: string) {
  return useQuery({
    queryKey: ["latest-entry", profileId, module],
    enabled: !!profileId,
    staleTime: 30_000,
    queryFn: async () => {
      if (!profileId) return null;
      const supabase = getSupabase();
      const { data } = await supabase
        .from("entries")
        .select("id, type, occurred_at, data, deleted_at")
        .eq("profile_id", profileId)
        .eq("type", module)
        .is("deleted_at", null)
        .order("occurred_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data ?? null;
    },
  });
}
