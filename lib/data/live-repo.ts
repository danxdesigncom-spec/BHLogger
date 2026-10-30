"use client";

import { createClient } from "@/lib/supabase/client";
import * as entryActions from "@/lib/actions/entries";
import * as medActions from "@/lib/actions/medications";
import * as favoriteActions from "@/lib/actions/favorites";
import { outbox } from "./outbox";
import { matchesData, type Actor, type EntryQuery, type LocalEntry, type Repo } from "./types";

const PAGE = 1000;

export function createLiveRepo(actor: Actor, householdId: string): Repo {
  const supabase = createClient();

  return {
    mode: "live",

    async listEntries(q: EntryQuery) {
      // Someone in more than one household sees only the active one's entries: RLS would allow them all,
      // and this device's cache and outbox can hold entries from a household used earlier.
      const here = (rows: LocalEntry[]) => rows.filter((e) => e.household_id === householdId);
      const rows: LocalEntry[] = [];
      for (let from = 0; ; from += PAGE) {
        let query = supabase.from("entries").select("*").eq("household_id", householdId).order("occurred_at", { ascending: false });
        query = q.deleted === "only" ? query.not("deleted_at", "is", null) : query.is("deleted_at", null);
        if (q.profileId) query = query.eq("profile_id", q.profileId);
        if (q.types?.length) query = query.in("type", q.types);
        if (q.from) query = query.gte("occurred_at", q.from);
        if (q.to) query = query.lte("occurred_at", q.to);
        const take = q.limit ? Math.min(PAGE, q.limit - rows.length) : PAGE;
        const { data, error } = await query.range(from, from + take - 1);
        if (error) {
          // Offline or failing: fall back to entries cached on this device.
          return here(await outbox.cachedEntries(q));
        }
        rows.push(...(data as LocalEntry[]));
        if (data.length < take || (q.limit && rows.length >= q.limit)) break;
      }
      await outbox.cacheEntries(rows);
      return here(await outbox.mergePending(rows, q));
    },

    async latestEntry(profileId, type, match) {
      let query = supabase.from("entries").select("*").eq("household_id", householdId).eq("profile_id", profileId).eq("type", type).is("deleted_at", null);
      for (const [k, v] of Object.entries(match ?? {})) query = query.eq(`data->>${k}`, v);
      const { data, error } = await query.order("occurred_at", { ascending: false }).limit(1).maybeSingle();
      const pending = (await outbox.pendingEntries())
        .filter((e) => e.profile_id === profileId && e.type === type && matchesData(e.data, match))
        .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))[0];
      const server = error ? await outbox.cachedLatest(profileId, type, match) : (data as LocalEntry | null);
      if (pending && (!server || pending.occurred_at > server.occurred_at)) return pending;
      return server;
    },

    async getEntry(id) {
      const pending = (await outbox.pendingEntries()).find((e) => e.id === id);
      if (pending) return pending;
      const { data } = await supabase.from("entries").select("*").eq("id", id).maybeSingle();
      return (data as LocalEntry | null) ?? null;
    },

    async saveEntry(e) {
      // Saving never waits on the network: the outbox persists it, then syncs (non-negotiable 5).
      await outbox.enqueueSave(e, actor);
      return { success: true };
    },

    updateEntry: (id, patch) => entryActions.updateEntry(id, patch),

    async deleteEntry(id) {
      if (await outbox.cancelPending(id)) return { success: true };
      return entryActions.deleteEntry(id);
    },

    restoreEntry: (id) => entryActions.restoreEntry(id),

    async listRevisions(entryId) {
      const { data } = await supabase.from("entry_revisions").select("*").eq("entry_id", entryId).order("changed_at", { ascending: false });
      return data ?? [];
    },

    async listMedications(profileId) {
      const { data } = await supabase.from("medications").select("*").eq("profile_id", profileId).order("name");
      return data ?? [];
    },

    saveMedication: (m) => medActions.saveMedication(m),

    async listMedicationChanges(profileId) {
      const { data: meds } = await supabase.from("medications").select("id").eq("profile_id", profileId);
      const ids = ((meds ?? []) as { id: string }[]).map((m) => m.id);
      if (!ids.length) return [];
      const { data } = await supabase.from("medication_changes").select("*").in("medication_id", ids).order("effective_at");
      return data ?? [];
    },

    async listAppointments(profileId) {
      const { data } = await supabase.from("appointments").select("*").eq("profile_id", profileId).order("date");
      return data ?? [];
    },

    addAppointment: (a) => medActions.addAppointment(a),

    async listOptions(profileId, module) {
      const { data } = await supabase
        .from("option_lists")
        .select("*")
        .eq("household_id", householdId)
        .eq("module", module)
        .eq("archived", false)
        .or(`profile_id.eq.${profileId},profile_id.is.null`)
        .order("sort_order");
      return data ?? [];
    },

    addOption: (o) => medActions.addOption(o),
    archiveOption: (id) => medActions.archiveOption(id),
    updateProfileSettings: (id, s) => medActions.updateProfileSettings(id, s),

    async listFavorites(profileId) {
      const { data } = await supabase.from("favorites").select("*").eq("profile_id", profileId).order("sort_order").order("created_at");
      return data ?? [];
    },

    addFavorite: (f) => favoriteActions.addFavorite(f),
    removeFavorite: (id) => favoriteActions.removeFavorite(id),
    reorderFavorites: (profileId, ids) => favoriteActions.reorderFavorites(profileId, ids),
    pendingCount: () => outbox.pendingCount(),
    forgetProfile: (profileId) => outbox.forgetProfile(profileId),
  };
}
