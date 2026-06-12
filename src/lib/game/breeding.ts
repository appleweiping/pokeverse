import type { DexEntry, Mon } from "../types";
import { getSpecies, loadDex } from "../data/dex";
import { createMon, movesAtLevel } from "./factory";

/** Reverse evolution map (childId -> parentId), built lazily from dex evo edges. */
let parentOf: Map<number, number> | null = null;

async function getParentMap(): Promise<Map<number, number>> {
  if (parentOf) return parentOf;
  const dex = await loadDex();
  parentOf = new Map();
  for (const e of dex) {
    for (const edge of e.evo ?? []) parentOf.set(edge.to, e.id);
  }
  return parentOf;
}

/** Walk evolution edges backwards to the base form of a species' line. */
export async function baseFormOf(speciesId: number): Promise<number> {
  const map = await getParentMap();
  let cur = speciesId;
  const seen = new Set<number>();
  while (map.has(cur) && !seen.has(cur)) {
    seen.add(cur);
    cur = map.get(cur)!;
  }
  return cur;
}

export function canBreed(species: DexEntry): boolean {
  const eg = species.eg ?? [];
  return eg.length > 0 && !eg.includes("no-eggs");
}

/** Day-care compatibility: Ditto pairs with any breedable mon; else shared egg group + opposite genders. */
export function compatible(a: DexEntry, am: Mon, b: DexEntry, bm: Mon): boolean {
  const aD = (a.eg ?? []).includes("ditto");
  const bD = (b.eg ?? []).includes("ditto");
  if (aD && bD) return false;
  if (aD) return canBreed(b);
  if (bD) return canBreed(a);
  if (!canBreed(a) || !canBreed(b)) return false;
  if (!(a.eg ?? []).some((g) => (b.eg ?? []).includes(g))) return false;
  return (am.gender === "m" && bm.gender === "f") || (am.gender === "f" && bm.gender === "m");
}

/** The species an egg will contain: base form of the non-Ditto mother's line. */
export async function eggSpeciesOf(a: DexEntry, am: Mon, b: DexEntry, bm: Mon): Promise<number> {
  const aD = (a.eg ?? []).includes("ditto");
  const bD = (b.eg ?? []).includes("ditto");
  let lineage: number;
  if (aD) lineage = b.id;
  else if (bD) lineage = a.id;
  else lineage = am.gender === "f" ? a.id : b.id;
  return baseFormOf(lineage);
}

/**
 * Produce an egg Mon. Inherits 3 random IV slots from random parents
 * (the rest rolled fresh) — the classic Destiny-Knot-less rule.
 */
export async function makeEgg(parentA: Mon, parentB: Mon, ot: string): Promise<Mon> {
  const [spA, spB] = await Promise.all([getSpecies(parentA.speciesId), getSpecies(parentB.speciesId)]);
  const childId = await eggSpeciesOf(spA, parentA, spB, parentB);
  const child = await getSpecies(childId);
  const egg = await createMon(childId, 1, ot);
  // IV inheritance: 3 distinct stat slots copied from a random parent each
  const slots = [0, 1, 2, 3, 4, 5].sort(() => Math.random() - 0.5).slice(0, 3);
  for (const s of slots) {
    egg.ivs[s] = (Math.random() < 0.5 ? parentA : parentB).ivs[s];
  }
  egg.egg = { steps: ((child.hc ?? 20) + 1) * 64 };
  return egg;
}

/** Hatch an egg in place: clears the egg marker and re-rolls level-1 moves. */
export async function hatchEgg(mon: Mon): Promise<void> {
  delete mon.egg;
  mon.moves = await movesAtLevel(mon.speciesId, mon.level);
}
