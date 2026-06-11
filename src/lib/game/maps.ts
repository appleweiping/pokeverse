import type { Dir } from "../types";
import { T } from "./tiles";

// ---------------------------------------------------------------------------
// World data: the Aurora region. Maps are authored as ASCII grids: readable,
// diff-able, and trivially extensible. One char = one tile (legend below).
// ---------------------------------------------------------------------------

export const LEGEND: Record<string, T> = {
  ".": T.GROUND, ",": T.PATH, g: T.TALLGRASS, T: T.TREE, t: T.TREE_DARK,
  "~": T.WATER, f: T.FLOWER, r: T.ROCK, "#": T.FENCE, s: T.SIGN,
  W: T.WALL, R: T.ROOF_RED, B: T.ROOF_BLUE, G: T.ROOF_GRAY, D: T.DOOR, w: T.WINDOW,
  _: T.FLOOR, I: T.IWALL, u: T.RUG, m: T.MAT, a: T.TABLE, b: T.SHELF,
  E: T.BED, P: T.PC, c: T.COUNTER, h: T.HEALER,
  "-": T.CAVE_FLOOR, C: T.CAVE_WALL, L: T.LEDGE, S: T.SAND, F: T.GYM_FLOOR, X: T.STATUE,
};

export interface WarpDef { x: number; y: number; to: string; tx: number; ty: number; dir?: Dir }
export interface SignDef { x: number; y: number; textKey: string }
export interface ItemSpot { x: number; y: number; item: string; qty: number; flag: string }

export interface TrainerDef {
  id: string;
  nameKey: string;
  preKey: string;
  loseKey: string;
  team: { speciesId: number; level: number }[];
  prize: number;
  badge?: string;
  winKey?: string; // shown if player loses
}

export interface NpcDef {
  id: string;
  x: number; y: number;
  dir: Dir;
  palette: string;
  dialogKeys?: string[];
  script?: "professor" | "nurse" | "mart" | "mom" | "rivalIdle";
  trainer?: TrainerDef;
  /** only visible when this flag is truthy / falsy */
  ifFlag?: string;
  ifNotFlag?: string;
}

export interface EncounterTable {
  /** [speciesId, weight, minLv, maxLv] */
  table: [number, number, number, number][];
  rate: number;
}

export interface MapDef {
  id: string;
  nameKey: string;
  music: string;
  indoor?: boolean;
  grid: string[];
  warps: WarpDef[];
  signs: SignDef[];
  npcs: NpcDef[];
  items: ItemSpot[];
  encounters?: EncounterTable;
}

export interface CompiledMap extends MapDef {
  w: number;
  h: number;
  tiles: Uint8Array;
}

const TRAINERS = {
  bug1: {
    id: "bug1", nameKey: "story.tn.bug1", preKey: "story.trainer_bug1_pre",
    loseKey: "story.trainer_bug1_lose",
    team: [{ speciesId: 10, level: 4 }, { speciesId: 13, level: 4 }], prize: 120,
  } as TrainerDef,
  lass1: {
    id: "lass1", nameKey: "story.tn.lass1", preKey: "story.trainer_lass1_pre",
    loseKey: "story.trainer_lass1_lose",
    team: [{ speciesId: 16, level: 5 }, { speciesId: 19, level: 5 }], prize: 150,
  } as TrainerDef,
  bug2: {
    id: "bug2", nameKey: "story.tn.bug1", preKey: "story.trainer_bug1_pre",
    loseKey: "story.trainer_bug1_lose",
    team: [{ speciesId: 10, level: 6 }, { speciesId: 11, level: 6 }, { speciesId: 13, level: 6 }], prize: 180,
  } as TrainerDef,
  gym1: {
    id: "gym1", nameKey: "story.tn.gym1", preKey: "story.gym1_pre",
    loseKey: "story.gym1_win",
    team: [{ speciesId: 74, level: 10 }, { speciesId: 95, level: 12 }], prize: 1500, badge: "boulder",
  } as TrainerDef,
};

export const MAPS: Record<string, MapDef> = {
  // ========================================================= SPROUT TOWN
  "sprout-town": {
    id: "sprout-town",
    nameKey: "story.sign_sprout",
    music: "town",
    grid: [
      "TTTTTTTTTT,,,,TTTTTTTTTT",
      "T.........,,,,.........T",
      "T..RRRRR..,,,,..RRRRR..T",
      "T..RRRRR..,,,,..RRRRR..T",
      "T..WwDwW..,,,,..WwDwW..T",
      "T....,....,,,,....,....T",
      "T,,,,,,,,,,,,,,,,,,,,,,T",
      "T..ff......,,......ff..T",
      "T..ff......,,......ff..T",
      "T........GGGGGGGG......T",
      "T........GGGGGGGG......T",
      "T........WwwDwwwW......T",
      "T...........,..........T",
      "T,,,,,,,,,,,,,,,,,,,,,,T",
      "T............s.........T",
      "T......................T",
      "T..ff..........ff......T",
      "T......................T",
      "T......................T",
      "TTTTTTTTTTTTTTTTTTTTTTTT",
    ],
    warps: [
      { x: 5, y: 4, to: "player-home", tx: 7, ty: 5, dir: "up" },
      { x: 12, y: 11, to: "lab", tx: 6, ty: 6, dir: "up" },
      { x: 10, y: 0, to: "route-1", tx: 8, ty: 34, dir: "up" },
      { x: 11, y: 0, to: "route-1", tx: 9, ty: 34, dir: "up" },
      { x: 12, y: 0, to: "route-1", tx: 10, ty: 34, dir: "up" },
      { x: 13, y: 0, to: "route-1", tx: 11, ty: 34, dir: "up" },
    ],
    signs: [
      { x: 13, y: 14, textKey: "story.sign_sprout" },
    ],
    npcs: [
      { id: "town-boy", x: 4, y: 8, dir: "down", palette: "boy", dialogKeys: ["story.npc_town1"] },
      { id: "town-girl", x: 16, y: 13, dir: "left", palette: "girl", dialogKeys: ["story.npc_town2"] },
      { id: "town-old", x: 20, y: 7, dir: "down", palette: "oldman", dialogKeys: ["story.npc_town3"] },
    ],
    items: [],
  },

  // ========================================================= PLAYER HOME
  "player-home": {
    id: "player-home",
    nameKey: "story.sign_sprout",
    music: "town",
    indoor: true,
    grid: [
      "IIIIIIIIII",
      "I_b_P___EI",
      "I________I",
      "I__aa____I",
      "I__aa____I",
      "I________I",
      "I______m_I",
      "IIIIIIIIII",
    ],
    warps: [{ x: 7, y: 6, to: "sprout-town", tx: 5, ty: 5, dir: "down" }],
    signs: [],
    npcs: [
      { id: "mom", x: 3, y: 5, dir: "down", palette: "mom", script: "mom" },
    ],
    items: [],
  },

  // ========================================================= LAB
  lab: {
    id: "lab",
    nameKey: "story.sign_sprout",
    music: "town",
    indoor: true,
    grid: [
      "IIIIIIIIIIII",
      "I_bbb__bbb_I",
      "I__________I",
      "I__aaa_____I",
      "I__________I",
      "I__________I",
      "I__________I",
      "I_____m____I",
      "IIIIIIIIIIII",
    ],
    warps: [{ x: 6, y: 7, to: "sprout-town", tx: 12, ty: 12, dir: "down" }],
    signs: [],
    npcs: [
      { id: "professor", x: 6, y: 3, dir: "down", palette: "professor", script: "professor" },
      { id: "assistant", x: 2, y: 5, dir: "right", palette: "clerk", dialogKeys: ["story.npc_center1"] },
    ],
    items: [],
  },

  // ========================================================= ROUTE 1
  "route-1": {
    id: "route-1",
    nameKey: "story.sign_route1",
    music: "route",
    grid: [
      "TTTTTTTT,,,,TTTTTTTT",
      "T......,,,,........T",
      "T..ggg.,,,,..ggg...T",
      "T..ggg.,,,,..ggg...T",
      "T..ggg.,,,,..ggg...T",
      "T......,,,,........T",
      "T......,,,,....s...T",
      "T..,,,,,,,,........T",
      "T..,,..............T",
      "T..,,..ggggg.......T",
      "T..,,..ggggg.......T",
      "T..,,..ggggg.......T",
      "T..,,..............T",
      "T..,,,,,,,,,,......T",
      "T............,,....T",
      "T....LLLLL...,,....T",
      "T............,,....T",
      "T..ggggg.....,,....T",
      "T..ggggg.....,,....T",
      "T..ggggg.....,,....T",
      "T............,,....T",
      "T......,,,,,,,,....T",
      "T......,,..........T",
      "T......,,..ggg.....T",
      "T......,,..ggg.....T",
      "T......,,..ggg.....T",
      "T......,,..........T",
      "T..f...,,.....f....T",
      "T......,,..........T",
      "T......,,,,,.......T",
      "T........,,........T",
      "T........,,........T",
      "T..ggg...,,........T",
      "T..ggg...,,........T",
      "T........,,........T",
      "T........,,........T",
      "TTTTTTTT,,,,TTTTTTTT",
    ],
    warps: [
      { x: 8, y: 0, to: "breeze-city", tx: 12, ty: 19, dir: "up" },
      { x: 9, y: 0, to: "breeze-city", tx: 13, ty: 19, dir: "up" },
      { x: 10, y: 0, to: "breeze-city", tx: 14, ty: 19, dir: "up" },
      { x: 11, y: 0, to: "breeze-city", tx: 15, ty: 19, dir: "up" },
      { x: 8, y: 35, to: "sprout-town", tx: 10, ty: 1, dir: "down" },
      { x: 9, y: 35, to: "sprout-town", tx: 11, ty: 1, dir: "down" },
      { x: 10, y: 35, to: "sprout-town", tx: 12, ty: 1, dir: "down" },
      { x: 11, y: 35, to: "sprout-town", tx: 13, ty: 1, dir: "down" },
    ],
    signs: [{ x: 15, y: 6, textKey: "story.sign_route1" }],
    npcs: [
      { id: "route-boy", x: 14, y: 8, dir: "down", palette: "boy", dialogKeys: ["story.npc_route1"] },
      {
        id: "tr-bug1", x: 13, y: 10, dir: "left", palette: "bugcatcher",
        trainer: TRAINERS.bug1,
      },
      {
        id: "tr-lass1", x: 10, y: 24, dir: "left", palette: "lass",
        trainer: TRAINERS.lass1,
      },
      { id: "route-old", x: 5, y: 21, dir: "right", palette: "oldman", dialogKeys: ["story.npc_route2"] },
    ],
    items: [
      { x: 4, y: 16, item: "poke-ball", qty: 3, flag: "item:r1-balls" },
      { x: 16, y: 27, item: "potion", qty: 2, flag: "item:r1-potion" },
    ],
    encounters: {
      rate: 0.13,
      table: [
        [16, 30, 2, 4], [19, 30, 2, 4], [10, 15, 2, 4], [13, 15, 2, 4], [25, 10, 3, 5],
      ],
    },
  },

  // ========================================================= BREEZE CITY
  "breeze-city": {
    id: "breeze-city",
    nameKey: "story.sign_breeze",
    music: "town",
    grid: [
      "TTTTTTTTTTTTTTTTTTTTTTTTTTTT",
      "T~~.....GGGGGGG............T",
      "T~~.....GGGGGGG............T",
      "T~~.....GGGGGGG............T",
      "T~~.....WwwDwwW............T",
      "T~~........,...............T",
      "T~~,,,,,,,,,,,,,,,,,,,,,,,,,",
      "T~~,,...RRRRR....BBBBB.....T",
      "T~~,,...RRRRR....BBBBB.....T",
      "T~~,,...WwDwW....WwDwW.....T",
      "T~~,,.....,........,.......T",
      "T~~,,,,,,,,,,,,,,,,,,,,,,..T",
      "T~~,,......................T",
      "T~~,,..RRRRR...s...RRRRR...T",
      "T~~,,..RRRRR.......RRRRR...T",
      "T~~,,..WwDwW.......WwDwW...T",
      "T~~,,....,...........,.....T",
      "T~~,,,,,,,,,,,,,,,,,,,,....T",
      "T~~.........,,,,...........T",
      "T...........,,,,...........T",
      "T...........,,,,...........T",
      "TTTTTTTTTTTT,,,,TTTTTTTTTTTT",
    ],
    warps: [
      { x: 11, y: 4, to: "gym-breeze", tx: 6, ty: 10, dir: "up" },
      { x: 10, y: 9, to: "pokecenter", tx: 6, ty: 4, dir: "up" },
      { x: 19, y: 9, to: "mart", tx: 5, ty: 4, dir: "up" },
      { x: 9, y: 15, to: "house-breeze", tx: 5, ty: 4, dir: "up" },
      { x: 12, y: 21, to: "route-1", tx: 8, ty: 1, dir: "down" },
      { x: 13, y: 21, to: "route-1", tx: 9, ty: 1, dir: "down" },
      { x: 14, y: 21, to: "route-1", tx: 10, ty: 1, dir: "down" },
      { x: 15, y: 21, to: "route-1", tx: 11, ty: 1, dir: "down" },
      { x: 27, y: 6, to: "verdant-forest", tx: 22, ty: 6, dir: "right" },
    ],
    signs: [{ x: 15, y: 13, textKey: "story.sign_breeze" }],
    npcs: [
      { id: "breeze-girl", x: 8, y: 5, dir: "right", palette: "girl", dialogKeys: ["story.npc_breeze1"] },
      { id: "breeze-boy", x: 17, y: 12, dir: "down", palette: "boy", dialogKeys: ["story.npc_breeze2"] },
    ],
    items: [],
  },

  // ========================================================= POKECENTER
  pokecenter: {
    id: "pokecenter",
    nameKey: "story.sign_breeze",
    music: "center",
    indoor: true,
    grid: [
      "IIIIIIIIIIII",
      "IP________hI",
      "I___cccc___I",
      "I__________I",
      "I__________I",
      "I_____m____I",
      "IIIIIIIIIIII",
    ],
    warps: [{ x: 6, y: 5, to: "breeze-city", tx: 10, ty: 10, dir: "down" }],
    signs: [],
    npcs: [
      { id: "nurse", x: 5, y: 1, dir: "down", palette: "nurse", script: "nurse" },
    ],
    items: [],
  },

  // ========================================================= MART
  mart: {
    id: "mart",
    nameKey: "story.sign_breeze",
    music: "center",
    indoor: true,
    grid: [
      "IIIIIIIIII",
      "Ibbb_____I",
      "I________I",
      "I__cc____I",
      "I________I",
      "I____m___I",
      "IIIIIIIIII",
    ],
    warps: [{ x: 5, y: 5, to: "breeze-city", tx: 19, ty: 10, dir: "down" }],
    signs: [],
    npcs: [
      { id: "clerk", x: 3, y: 2, dir: "down", palette: "clerk", script: "mart" },
    ],
    items: [],
  },

  // ========================================================= HOUSE (BREEZE)
  "house-breeze": {
    id: "house-breeze",
    nameKey: "story.sign_breeze",
    music: "town",
    indoor: true,
    grid: [
      "IIIIIIIIII",
      "I_b____E_I",
      "I________I",
      "I__aa____I",
      "I________I",
      "I____m___I",
      "IIIIIIIIII",
    ],
    warps: [{ x: 5, y: 5, to: "breeze-city", tx: 9, ty: 16, dir: "down" }],
    signs: [],
    npcs: [
      { id: "house-old", x: 6, y: 3, dir: "left", palette: "oldman", dialogKeys: ["story.npc_breeze2"] },
    ],
    items: [],
  },

  // ========================================================= GYM
  "gym-breeze": {
    id: "gym-breeze",
    nameKey: "story.sign_gym1",
    music: "gym",
    indoor: true,
    grid: [
      "IIIIIIIIIIII",
      "IFFFFFFFFFFI",
      "IFFFXFFXFFFI",
      "IFFFFFFFFFFI",
      "IFFFFFFFFFFI",
      "IFFrFFFFrFFI",
      "IFFFFFFFFFFI",
      "IFFFFFFFFFFI",
      "IFFrFFFFrFFI",
      "IFFFFFFFFFFI",
      "IFFFFFFFFFFI",
      "IFFFFFmFFFFI",
      "IIIIIIIIIIII",
    ],
    warps: [{ x: 6, y: 11, to: "breeze-city", tx: 11, ty: 5, dir: "down" }],
    signs: [],
    npcs: [
      {
        id: "gym-leader", x: 5, y: 3, dir: "down", palette: "leader",
        trainer: TRAINERS.gym1,
      },
      {
        id: "gym-lass", x: 5, y: 7, dir: "down", palette: "lass",
        trainer: {
          id: "gymlass", nameKey: "story.tn.lass1", preKey: "story.trainer_lass1_pre",
          loseKey: "story.trainer_lass1_lose",
          team: [{ speciesId: 74, level: 8 }], prize: 200,
        },
      },
    ],
    items: [],
  },

  // ========================================================= VERDANT FOREST
  "verdant-forest": {
    id: "verdant-forest",
    nameKey: "story.sign_forest",
    music: "forest",
    grid: [
      "tttttttttttttttttttttttt",
      "t..ggg........t..ggg...t",
      "t..ggg...tt...t..ggg...t",
      "t..ggg...tt............t",
      "t........tt...tttt.....t",
      "t..tttt................t",
      "t......................,",
      "t..gggg......tttt......t",
      "t..gggg................t",
      "t..gggg....tt..........t",
      "t..........tt..ggggg...t",
      "t..tt..........ggggg...t",
      "t..tt..........ggggg...t",
      "t......tttt............t",
      "t......................t",
      "t...ggggg.....tt.......t",
      "t...ggggg.....tt.......t",
      "t...ggggg..............t",
      "t......................t",
      "tttttttttttttttttttttttt",
    ],
    warps: [{ x: 23, y: 6, to: "breeze-city", tx: 26, ty: 6, dir: "left" }],
    signs: [{ x: 21, y: 5, textKey: "story.sign_forest" }],
    npcs: [
      {
        id: "tr-bug2", x: 8, y: 8, dir: "down", palette: "bugcatcher",
        trainer: TRAINERS.bug2,
      },
      { id: "forest-girl", x: 17, y: 14, dir: "down", palette: "girl", dialogKeys: ["story.npc_forest1"] },
    ],
    items: [
      { x: 4, y: 18, item: "great-ball", qty: 1, flag: "item:vf-gb" },
      { x: 20, y: 3, item: "antidote", qty: 1, flag: "item:vf-anti" },
    ],
    encounters: {
      rate: 0.15,
      table: [
        [10, 22, 4, 7], [11, 8, 5, 7], [13, 22, 4, 7], [14, 8, 5, 7],
        [25, 10, 4, 7], [43, 15, 4, 7], [69, 15, 4, 7],
      ],
    },
  },
};

// ---------------------------------------------------------------------------

const compiled = new Map<string, CompiledMap>();

export function getMap(id: string): CompiledMap {
  const hit = compiled.get(id);
  if (hit) return hit;
  const def = MAPS[id];
  if (!def) throw new Error(`unknown map: ${id}`);
  const h = def.grid.length;
  const w = Math.max(...def.grid.map((r) => r.length));
  const tiles = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = def.grid[y];
    if (row.length !== w) {
      console.warn(`[maps] ${id} row ${y} length ${row.length} != ${w}`);
    }
    for (let x = 0; x < w; x++) {
      const ch = row[x] ?? "T";
      tiles[y * w + x] = LEGEND[ch] ?? T.GROUND;
    }
  }
  const cm: CompiledMap = { ...def, w, h, tiles };
  compiled.set(id, cm);
  return cm;
}

export function tileAt(map: CompiledMap, x: number, y: number): T {
  if (x < 0 || y < 0 || x >= map.w || y >= map.h) return T.TREE;
  return map.tiles[y * map.w + x] as T;
}
