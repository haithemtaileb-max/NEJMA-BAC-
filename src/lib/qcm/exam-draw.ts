/**
 * Draw a module-balanced exam paper — the TypeScript twin of `start_exam`
 * (used in demo mode). Questions are ranked randomly inside each module, then
 * taken round-robin (every module's #1, then every module's #2, …) and the
 * final paper is shuffled.
 */
export function drawBalanced<T extends { moduleId: string }>(
  pool: readonly T[],
  count: number,
  random: () => number = Math.random,
): T[] {
  const byModule = new Map<string, T[]>();
  for (const item of pool) {
    const list = byModule.get(item.moduleId) ?? [];
    list.push(item);
    byModule.set(item.moduleId, list);
  }

  const ranked = [...byModule.values()].flatMap((items) =>
    shuffle(items, random).map((item, rank) => ({ item, rank, tieBreak: random() })),
  );
  ranked.sort((a, b) => a.rank - b.rank || a.tieBreak - b.tieBreak);

  return shuffle(
    ranked.slice(0, Math.max(0, count)).map((r) => r.item),
    random,
  );
}

/** Fisher–Yates, returns a new array. */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
