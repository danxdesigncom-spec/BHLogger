// QL-12: Home tile order per profile, stored as settings.tile_order so it follows the profile to every device.
// Hiding a tile is the enabled_modules switch (ACC-06); unknown or missing modules fall back to the default order.

export const TILE_ORDER = ["bathroom", "eating", "mood", "activity", "medication"] as const;
export type TileModule = (typeof TILE_ORDER)[number];

export function orderTiles(saved: unknown): TileModule[] {
  const known = new Set<string>(TILE_ORDER);
  const picked = Array.isArray(saved) ? [...new Set(saved.filter((m): m is TileModule => typeof m === "string" && known.has(m)))] : [];
  return [...picked, ...TILE_ORDER.filter((m) => !picked.includes(m))];
}

export function moveTile(order: TileModule[], module: TileModule, by: -1 | 1): TileModule[] {
  const i = order.indexOf(module);
  const j = i + by;
  if (i < 0 || j < 0 || j >= order.length) return order;
  const next = [...order];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/**
 * Medication is a full-width row. A half-width tile left alone just before it would leave a gap,
 * so that tile spans the row too.
 */
export function wideTiles(visible: TileModule[]): Set<TileModule> {
  const wide = new Set<TileModule>(["medication"]);
  let run: TileModule[] = [];
  for (const m of visible) {
    if (m === "medication") {
      if (run.length % 2 === 1) wide.add(run[run.length - 1]);
      run = [];
    } else run.push(m);
  }
  return wide;
}
