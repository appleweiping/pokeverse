import type { DexEntry, Mon, MonMove } from "../types";
import { getSpecies, getMoveMap, loadLearnsets } from "../data/dex";
import { calcStats, expForLevel, levelForExp, randomIVs, uid, NATURES } from "../data/formulas";

/** Pick the newest `count` level-up moves known at `level`. */
export async function movesAtLevel(speciesId: number, level: number, count = 4): Promise<MonMove[]> {
  const [learnsets, moveMap] = await Promise.all([loadLearnsets(), getMoveMap()]);
  const ls = learnsets[String(speciesId)] ?? [];
  const known: number[] = [];
  for (const [lv, moveId] of ls) {
    if (lv > level) break;
    if (!moveMap.has(moveId)) continue;
    // re-learning pushes the move to the "most recent" end
    const idx = known.indexOf(moveId);
    if (idx >= 0) known.splice(idx, 1);
    known.push(moveId);
  }
  const picked = known.slice(-count);
  // absolute fallback so no Pokémon is ever moveless: Tackle (33)
  if (picked.length === 0) picked.push(33);
  return picked.map((id) => {
    const pp = moveMap.get(id)?.pp ?? 20;
    return { id, pp, maxPp: pp };
  });
}

export interface MonWithSpecies {
  mon: Mon;
  species: DexEntry;
}

/** Pick a non-hidden ability slug (hidden has 1/8 chance). */
export function rollAbility(species: DexEntry, rng: () => number): string {
  const list = species.ab ?? [];
  if (!list.length) return "";
  const normals = list.filter((a) => !a.startsWith("!"));
  const hidden = list.filter((a) => a.startsWith("!")).map((a) => a.slice(1));
  if (hidden.length && rng() < 1 / 8) return hidden[Math.floor(rng() * hidden.length)];
  if (!normals.length) return hidden[0] ?? "";
  return normals[Math.floor(rng() * normals.length)];
}

export function rollGender(species: DexEntry, rng: () => number): "m" | "f" | "n" {
  const gr = species.gen ?? -1;
  if (gr < 0) return "n";
  return rng() < gr / 8 ? "f" : "m";
}

export async function createMon(
  speciesId: number,
  level: number,
  ot: string,
  opts: { ball?: string; rng?: () => number; item?: string | null } = {}
): Promise<Mon> {
  const rng = opts.rng ?? Math.random;
  const species = await getSpecies(speciesId);
  const ivs = randomIVs(rng);
  const nature = Math.floor(rng() * NATURES.length);
  const stats = calcStats(species.s, ivs, level, nature);
  const moves = await movesAtLevel(speciesId, level);
  return {
    uid: uid(),
    speciesId,
    level,
    exp: expForLevel(species.gr, level),
    ivs,
    nature,
    moves,
    curHP: stats[0],
    status: null,
    shiny: rng() < 1 / 512,
    ball: opts.ball ?? "poke-ball",
    ot,
    ability: rollAbility(species, rng),
    gender: rollGender(species, rng),
    item: opts.item ?? null,
  };
}

export function maxHPOf(mon: Mon, species: DexEntry): number {
  return calcStats(species.s, mon.ivs, mon.level, mon.nature)[0];
}

export function statsOf(mon: Mon, species: DexEntry) {
  return calcStats(species.s, mon.ivs, mon.level, mon.nature);
}

export function healMon(mon: Mon, species: DexEntry) {
  mon.curHP = maxHPOf(mon, species);
  mon.status = null;
  for (const m of mon.moves) m.pp = m.maxPp;
}

/** Apply exp; returns each level reached and moves newly learnable at those levels. */
export async function applyExp(
  mon: Mon,
  species: DexEntry,
  amount: number
): Promise<{ levels: number[]; newMoves: { level: number; moveId: number }[] }> {
  const levels: number[] = [];
  const newMoves: { level: number; moveId: number }[] = [];
  if (mon.level >= 100) return { levels, newMoves };
  const before = mon.level;
  mon.exp += amount;
  const after = Math.min(100, levelForExp(species.gr, mon.exp));
  if (after > before) {
    const learnsets = await loadLearnsets();
    const ls = learnsets[String(mon.speciesId)] ?? [];
    const oldMax = maxHPOf(mon, species);
    for (let lv = before + 1; lv <= after; lv++) {
      levels.push(lv);
      for (const [l, moveId] of ls) {
        if (l === lv && !mon.moves.some((m) => m.id === moveId)) {
          newMoves.push({ level: lv, moveId });
        }
      }
    }
    mon.level = after;
    // HP grows by the max-HP delta (classic behavior)
    const newMax = maxHPOf(mon, species);
    mon.curHP = Math.min(newMax, mon.curHP + (newMax - oldMax));
  }
  return { levels, newMoves };
}

/** Level-based evolution check. Returns the evolved species id, or null. */
export function levelEvolution(mon: Mon, species: DexEntry): number | null {
  for (const e of species.evo ?? []) {
    if (e.lv && mon.level >= e.lv) return e.to;
  }
  return null;
}

/** Stone/item evolution check. */
export function itemEvolution(species: DexEntry, itemName: string): number | null {
  for (const e of species.evo ?? []) {
    if (e.item === itemName) return e.to;
  }
  return null;
}

/** Mutate mon into the target species, preserving HP damage taken. */
export async function evolveMon(mon: Mon, toId: number): Promise<DexEntry> {
  const oldSpecies = await getSpecies(mon.speciesId);
  const lostHP = maxHPOf(mon, oldSpecies) - mon.curHP;
  mon.speciesId = toId;
  const newSpecies = await getSpecies(toId);
  mon.curHP = Math.max(1, maxHPOf(mon, newSpecies) - lostHP);
  return newSpecies;
}

export function learnMove(mon: Mon, moveId: number, pp: number, replaceIdx?: number) {
  const mv: MonMove = { id: moveId, pp, maxPp: pp };
  if (mon.moves.length < 4) mon.moves.push(mv);
  else if (replaceIdx !== undefined && replaceIdx >= 0 && replaceIdx < 4) mon.moves[replaceIdx] = mv;
}
