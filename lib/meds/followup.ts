// MED-12: which as-needed doses Home should ask "Did it help?" about.

export const FOLLOWUP_AFTER_MIN = 30;
export const FOLLOWUP_UNTIL_MIN = 240;

interface DoseLike {
  id: string;
  occurred_at: string;
  logged_by: string | null;
  deleted_at?: string | null;
  data: unknown;
}

/** Given or partial as-needed doses with no answer yet, 30 minutes to 4 hours old, that this person may edit. Newest first. */
export function followupDue<T extends DoseLike>(doses: T[], prnMedIds: Set<string>, now: Date, member: { userId: string; role: string }): T[] {
  return doses
    .filter((d) => {
      const data = (d.data ?? {}) as { medication_id?: string; outcome?: string; followup?: string | null };
      const ageMin = (now.getTime() - new Date(d.occurred_at).getTime()) / 60_000;
      return !d.deleted_at
        && prnMedIds.has(String(data.medication_id))
        && (data.outcome === "given" || data.outcome === "partial")
        && !data.followup
        && ageMin >= FOLLOWUP_AFTER_MIN && ageMin <= FOLLOWUP_UNTIL_MIN
        && (member.role === "admin" || (member.role === "caregiver" && d.logged_by === member.userId));
    })
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
}
