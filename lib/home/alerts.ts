// BTH-08: days since the last BM, and whether that crosses the profile's alert threshold.

export function daysSince(iso: string | null | undefined, now = new Date()): number | null {
  if (!iso) return null;
  return Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
}

export function bmAlert(lastBmIso: string | null | undefined, thresholdDays: number | null, now = new Date()) {
  const days = daysSince(lastBmIso, now);
  return {
    days,
    alert: thresholdDays !== null && days !== null && days >= thresholdDays,
    label: days === null ? null : days === 0 ? "BM today" : `${days} day${days === 1 ? "" : "s"} since BM`,
  };
}
