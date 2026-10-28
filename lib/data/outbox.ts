"use client";

import Dexie, { type Table } from "dexie";
import { saveEntry as saveEntryAction } from "@/lib/actions/entries";
import type { Json } from "@/lib/supabase/types";
import { matchesData, type Actor, type EntryQuery, type LocalEntry, type NewEntry } from "./types";

interface PendingRow {
  id: string;
  payload: NewEntry;
  entry: LocalEntry;
  attempts: number;
  lastError: string | null;
  createdAt: number;
}

class OutboxDb extends Dexie {
  pending!: Table<PendingRow, string>;
  cache!: Table<LocalEntry, string>;
  constructor() {
    super("bl-outbox");
    this.version(1).stores({ pending: "id, createdAt", cache: "id, profile_id, occurred_at" });
  }
}

type Listener = () => void;

const MAX_BACKOFF_MS = 60_000;

class Outbox {
  private db: OutboxDb | null = null;
  private listeners = new Set<Listener>();
  private flushing = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private wired = false;

  private get store(): OutboxDb {
    this.db ??= new OutboxDb();
    if (!this.wired && typeof window !== "undefined") {
      this.wired = true;
      window.addEventListener("online", () => void this.flush());
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") void this.flush();
      });
    }
    return this.db;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }

  async enqueueSave(e: NewEntry, actor: Actor): Promise<void> {
    const t = new Date().toISOString();
    const entry: LocalEntry = {
      id: e.id, household_id: e.householdId, profile_id: e.profileId, type: e.type, occurred_at: e.occurredAt, tz: e.tz,
      ended_at: null, data: e.data as Json, note: e.note ?? null, flagged_for_doctor: e.flaggedForDoctor,
      logged_by: actor.userId, logged_by_name: actor.name, logged_by_initials: actor.initials,
      created_at: t, updated_at: t, deleted_at: null, schema_version: 1, _sync: "pending",
    };
    await this.store.pending.put({ id: e.id, payload: e, entry, attempts: 0, lastError: null, createdAt: Date.now() });
    this.emit();
    void this.flush();
  }

  /** Undo before the entry ever reached the server: just drop it. */
  async cancelPending(id: string): Promise<boolean> {
    const row = await this.store.pending.get(id);
    if (!row) return false;
    await this.store.pending.delete(id);
    this.emit();
    return true;
  }

  async pendingEntries(): Promise<LocalEntry[]> {
    const rows = await this.store.pending.toArray();
    return rows.map((r) => ({ ...r.entry, _sync: r.lastError && r.attempts > 0 && !isNetworkError(r.lastError) ? "failed" : "pending" }));
  }

  async pendingCount(): Promise<number> {
    return this.store.pending.count();
  }

  async mergePending(rows: LocalEntry[], q: EntryQuery): Promise<LocalEntry[]> {
    if (q.deleted === "only") return rows;
    const seen = new Set(rows.map((r) => r.id));
    const pending = (await this.pendingEntries()).filter(
      (e) =>
        !seen.has(e.id) &&
        (!q.profileId || e.profile_id === q.profileId) &&
        (!q.types || q.types.includes(e.type)) &&
        (!q.from || e.occurred_at >= q.from) &&
        (!q.to || e.occurred_at <= q.to),
    );
    return [...pending, ...rows].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  }

  async cacheEntries(rows: LocalEntry[]): Promise<void> {
    if (rows.length) await this.store.cache.bulkPut(rows.map((r) => ({ ...r, _sync: "synced" as const })));
  }

  async cachedEntries(q: EntryQuery): Promise<LocalEntry[]> {
    const all = q.profileId ? await this.store.cache.where("profile_id").equals(q.profileId).toArray() : await this.store.cache.toArray();
    const rows = all
      .filter((e) => (q.deleted === "only" ? e.deleted_at !== null : e.deleted_at === null))
      .filter((e) => (!q.types || q.types.includes(e.type)) && (!q.from || e.occurred_at >= q.from) && (!q.to || e.occurred_at <= q.to));
    return this.mergePending(rows, q);
  }

  async cachedLatest(profileId: string, type: string, match?: Record<string, string>): Promise<LocalEntry | null> {
    const rows = await this.store.cache.where("profile_id").equals(profileId).toArray();
    return rows
      .filter((e) => e.type === type && e.deleted_at === null && matchesData(e.data, match))
      .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))[0] ?? null;
  }

  /** Sends queued entries oldest first. Upserts are idempotent on the client UUID, so retries never duplicate. */
  async flush(): Promise<void> {
    if (this.flushing || (typeof navigator !== "undefined" && !navigator.onLine)) return;
    this.flushing = true;
    let backoff = 0;
    try {
      const rows = await this.store.pending.orderBy("createdAt").toArray();
      for (const row of rows) {
        try {
          const result = await saveEntryAction(row.payload);
          if ("error" in result) {
            await this.store.pending.update(row.id, { attempts: row.attempts + 1, lastError: result.error });
            continue;
          }
          await this.store.pending.delete(row.id);
          await this.store.cache.put({ ...row.entry, _sync: "synced" });
        } catch (err) {
          await this.store.pending.update(row.id, { attempts: row.attempts + 1, lastError: `network: ${String(err)}` });
          backoff = Math.min(MAX_BACKOFF_MS, 2_000 * 2 ** row.attempts);
          break;
        }
      }
    } finally {
      this.flushing = false;
      this.emit();
    }
    if (backoff) {
      if (this.retryTimer) clearTimeout(this.retryTimer);
      this.retryTimer = setTimeout(() => void this.flush(), backoff);
    }
  }
}

function isNetworkError(msg: string) {
  return msg.startsWith("network:");
}

export const outbox = new Outbox();
