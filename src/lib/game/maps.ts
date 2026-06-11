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
  x: T.CUT_TREE, o: T.ROCK_SMASH, Z: T.BARRIER, z: T.SWITCH,
};

export interface WarpDef {
  x: number; y: number; to: string; tx: number; ty: number; dir?: Dir;
  /** warp only works when this flag is truthy; otherwise lockedKey dialogue shows */
  ifFlag?: string;
  lockedKey?: string;
}
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
  /** battle music override key (e.g. "aurora") */
  theme?: string;
  /** NPC disappears from the map after losing (fleeing grunts) */
  vanish?: boolean;
  /** one-time item handed over after victory */
  reward?: { item: string; qty: number };
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
  hiker1: {
    id: "hiker1", nameKey: "story.tn.hiker1", preKey: "story.trainer_hiker1_pre",
    loseKey: "story.trainer_hiker1_lose",
    team: [{ speciesId: 74, level: 12 }, { speciesId: 95, level: 12 }], prize: 360,
  } as TrainerDef,
  swimmer1: {
    id: "swimmer1", nameKey: "story.tn.swimmer1", preKey: "story.trainer_swimmer1_pre",
    loseKey: "story.trainer_swimmer1_lose",
    team: [{ speciesId: 72, level: 14 }, { speciesId: 90, level: 14 }], prize: 420,
  } as TrainerDef,
  gym2: {
    id: "gym2", nameKey: "story.tn.gym2", preKey: "story.gym2_pre",
    loseKey: "story.gym2_win",
    team: [{ speciesId: 90, level: 16 }, { speciesId: 121, level: 16 }, { speciesId: 130, level: 18 }],
    prize: 2400, badge: "tidal",
  } as TrainerDef,
  rocker1: {
    id: "rocker1", nameKey: "story.tn.rocker1", preKey: "story.trainer_rocker1_pre",
    loseKey: "story.trainer_rocker1_lose",
    team: [{ speciesId: 100, level: 18 }, { speciesId: 81, level: 18 }], prize: 540,
  } as TrainerDef,
  picnic1: {
    id: "picnic1", nameKey: "story.tn.picnic1", preKey: "story.trainer_picnic1_pre",
    loseKey: "story.trainer_picnic1_lose",
    team: [{ speciesId: 25, level: 19 }, { speciesId: 43, level: 18 }], prize: 570,
  } as TrainerDef,
  gym3: {
    id: "gym3", nameKey: "story.tn.gym3", preKey: "story.gym3_pre",
    loseKey: "story.gym3_win",
    team: [{ speciesId: 81, level: 20 }, { speciesId: 100, level: 20 }, { speciesId: 26, level: 22 }],
    prize: 3500, badge: "volt",
  } as TrainerDef,
  lass2: {
    id: "lass2", nameKey: "story.tn.lass2", preKey: "story.trainer_lass2_pre",
    loseKey: "story.trainer_lass2_lose",
    team: [{ speciesId: 43, level: 20 }, { speciesId: 44, level: 22 }], prize: 660,
  } as TrainerDef,
  camper1: {
    id: "camper1", nameKey: "story.tn.camper1", preKey: "story.trainer_camper1_pre",
    loseKey: "story.trainer_camper1_lose",
    team: [{ speciesId: 69, level: 20 }, { speciesId: 70, level: 21 }], prize: 630,
  } as TrainerDef,
  gym4: {
    id: "gym4", nameKey: "story.tn.gym4", preKey: "story.gym4_pre",
    loseKey: "story.gym4_win",
    team: [{ speciesId: 114, level: 24 }, { speciesId: 44, level: 24 }, { speciesId: 71, level: 26 }],
    prize: 4200, badge: "meadow",
  } as TrainerDef,
  aurorag1: {
    id: "aurorag1", nameKey: "story.tn.aurora_grunt", preKey: "story.aurora_g1_pre",
    loseKey: "story.aurora_g1_lose",
    team: [{ speciesId: 41, level: 18 }, { speciesId: 23, level: 18 }], prize: 400,
    theme: "aurora", vanish: true,
  } as TrainerDef,
  aurorag2: {
    id: "aurorag2", nameKey: "story.tn.aurora_grunt", preKey: "story.aurora_g2_pre",
    loseKey: "story.aurora_g2_lose",
    team: [{ speciesId: 109, level: 19 }, { speciesId: 41, level: 19 }], prize: 440,
    theme: "aurora", vanish: true,
  } as TrainerDef,
  aurorag3: {
    id: "aurorag3", nameKey: "story.tn.aurora_grunt", preKey: "story.aurora_g3_pre",
    loseKey: "story.aurora_g3_lose",
    team: [{ speciesId: 23, level: 21 }, { speciesId: 109, level: 21 }], prize: 480,
    theme: "aurora", vanish: true,
  } as TrainerDef,
  auroraboss1: {
    id: "auroraboss1", nameKey: "story.tn.aurora_boss", preKey: "story.aurora_boss_pre",
    loseKey: "story.aurora_boss_lose",
    team: [{ speciesId: 42, level: 23 }, { speciesId: 24, level: 23 }, { speciesId: 110, level: 24 }],
    prize: 2000, theme: "aurora",
    reward: { item: "thunder-stone", qty: 1 },
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
      "T..,,.............xT",
      "T..,,..ggggg.....o.T",
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
      "ttttttttt,,ttttttttttttt",
      "t..ggg...,,...ggg......t",
      "t..ggg..t,,t..ggg......t",
      "t..ggg...,,...........tt",
      "t.......,,....tttt.....t",
      "t..tttt.,,............tt",
      "t.......,,.............,",
      "t..gggg.,,...tttt.....tt",
      "t..gggg.,,............tt",
      "t..gggg.,,tt..........tt",
      "t.......,,tt..ggggg....t",
      "t..tt...,,....ggggg....t",
      "t..tt...,,....ggggg....t",
      "t.....tt,,............tt",
      "t.......,,............tt",
      "t...ggg,,.....tt.......t",
      "t...ggggg.....tt.......t",
      "t...ggggg.............tt",
      "t.....................tt",
      "tttttttttttttttttttttttt",
    ],
    warps: [
      { x: 23, y: 6, to: "breeze-city", tx: 26, ty: 6, dir: "left" },
      { x: 9, y: 0, to: "moonview-cave", tx: 8, ty: 16, dir: "up" },
      { x: 10, y: 0, to: "moonview-cave", tx: 9, ty: 16, dir: "up" },
    ],
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
      { x: 20, y: 17, item: "tm-72", qty: 1, flag: "item:vf-tm72" },
    ],
    encounters: {
      rate: 0.15,
      table: [
        [10, 22, 4, 7], [11, 8, 5, 7], [13, 22, 4, 7], [14, 8, 5, 7],
        [25, 10, 4, 7], [43, 15, 4, 7], [69, 15, 4, 7],
      ],
    },
  },

  // ========================================================= MOONVIEW CAVE
  "moonview-cave": {
    id: "moonview-cave",
    nameKey: "story.sign_cave",
    music: "cave",
    grid: [
      "CCCCCCCC--CCCCCCCC",
      "C----------------C",
      "C--gggg----gggg--C",
      "C--gggg----gggg--C",
      "C--CC--------CC--C",
      "C----------------C",
      "C---------rr-----C",
      "C----------------C",
      "C--gg--------gg--C",
      "C--CC--------CC--C",
      "C----------------C",
      "C--gggg----gggg--C",
      "C----------------C",
      "C--CC--------CC--C",
      "C----------------C",
      "C----------------C",
      "C----------------C",
      "CCCCCCCC--CCCCCCCC",
    ],
    warps: [
      { x: 8, y: 17, to: "verdant-forest", tx: 9, ty: 1, dir: "down" },
      { x: 9, y: 17, to: "verdant-forest", tx: 10, ty: 1, dir: "down" },
      { x: 8, y: 0, to: "route-2", tx: 7, ty: 22, dir: "up" },
      { x: 9, y: 0, to: "route-2", tx: 7, ty: 22, dir: "up" },
    ],
    signs: [],
    npcs: [
      { id: "tr-hiker1", x: 12, y: 6, dir: "left", palette: "oldman", trainer: TRAINERS.hiker1 },
      { id: "cave-hiker", x: 4, y: 11, dir: "right", palette: "boy", dialogKeys: ["story.npc_cave1"] },
    ],
    items: [
      { x: 14, y: 3, item: "moon-stone", qty: 1, flag: "item:mv-moon" },
      { x: 3, y: 13, item: "super-potion", qty: 2, flag: "item:mv-pot" },
      { x: 15, y: 16, item: "ultra-ball", qty: 1, flag: "item:mv-ub" },
      { x: 14, y: 15, item: "tm-157", qty: 1, flag: "item:mv-tm157" },
    ],
    encounters: {
      rate: 0.12,
      table: [
        [41, 30, 8, 12], [74, 25, 8, 12], [95, 8, 9, 12], [35, 6, 10, 13],
        [46, 16, 8, 11], [66, 15, 9, 12],
      ],
    },
  },

  // ========================================================= ROUTE 2
  "route-2": {
    id: "route-2",
    nameKey: "story.sign_route2",
    music: "route",
    grid: [
      "TTTTTTTT,,,,TTTTTTTT",
      "T......,,,,........T",
      "T.ggg..,,,,..ggg...T",
      "T.ggg..,,,,..ggg...T",
      "T......,,,,........T",
      "T..,,,,,,,,,,,,....T",
      "T..,,..........,...T",
      "T..,,.. fff ....,..T".replace(/ /g, "."),
      "T..,,..........,...T",
      "T..,,,,,,,,,,,,,...T",
      "T...........,,....TT",
      "T....LLLLL..,,.....T",
      "T...........,,.....T",
      "T..ggggg....,,.....T",
      "T..ggggg....,,.....T",
      "T..ggggg....,,.....T",
      "T...........,,.....T",
      "T......,,,,,,,.....T",
      "T......,,..........T",
      "T......,,..ggg.....T",
      "T......,,..ggg.....T",
      "T......,,..........T",
      "T......,,,,........T",
      "TTTTTTT,,TTTTTTTTTTT",
    ],
    warps: [
      { x: 9, y: 0, to: "moonview-cave", tx: 9, ty: 1, dir: "down" },
      { x: 10, y: 0, to: "moonview-cave", tx: 10, ty: 1, dir: "down" },
      { x: 7, y: 23, to: "tidal-town", tx: 12, ty: 1, dir: "up" },
    ],
    signs: [{ x: 14, y: 6, textKey: "story.sign_route2" }],
    npcs: [
      { id: "tr-swimmer1", x: 12, y: 13, dir: "left", palette: "lass", trainer: TRAINERS.swimmer1 },
      { id: "route2-boy", x: 5, y: 19, dir: "down", palette: "boy", dialogKeys: ["story.npc_route2b"] },
    ],
    items: [
      { x: 4, y: 14, item: "hyper-potion", qty: 1, flag: "item:r2-hp" },
      { x: 16, y: 19, item: "lum-berry", qty: 2, flag: "item:r2-lum" },
      { x: 16, y: 11, item: "tm-19", qty: 1, flag: "item:r2-tm19" },
    ],
    encounters: {
      rate: 0.13,
      table: [
        [16, 20, 9, 13], [19, 18, 9, 13], [21, 16, 10, 13], [69, 14, 9, 12],
        [43, 14, 9, 12], [48, 18, 10, 13],
      ],
    },
  },

  // ========================================================= TIDAL TOWN
  "tidal-town": {
    id: "tidal-town",
    nameKey: "story.sign_tidal",
    music: "town",
    grid: [
      "TTTTTTTTTTTT,,TTTTTTTTTTTT",
      "T..........,,,,..........T",
      "T..RRRRR...,,,,...BBBBB..T",
      "T..RRRRR...,,,,...BBBBB..T",
      "T..WwDwW...,,,,...WwDwW..T",
      "T....,.....,,,,.....,....T",
      "T,,,,,,,,,,,,,,,,,,,,,,,,,",
      "T..,,......,,......,,....T",
      "T..,,..GGGGGGGG....,,....T",
      "T..,,..GGGGGGGG....,,....T",
      "T..,,..WwwDwwwW....,,....T",
      "T..,,........,.....,,....T",
      "T..,,,,,,,,,,,,,,,,,,....T",
      "T~~~~~~~~~~~~~~~~~~~~~~~~T",
      "T~~~~~~~~~~~~~~~~~~~~~~~~T",
      "T~~~~SSSS~~~~~~~~SSSS~~~~T",
      "TSSSSSSSSSSSSSSSSSSSSSSSST",
      "TTTTTTTTTTTTTTTTTTTTTTTTTT",
    ],
    warps: [
      { x: 12, y: 0, to: "route-2", tx: 7, ty: 22, dir: "down" },
      { x: 13, y: 0, to: "route-2", tx: 7, ty: 22, dir: "down" },
      { x: 5, y: 4, to: "tidal-center", tx: 6, ty: 5, dir: "up" },
      { x: 19, y: 4, to: "tidal-mart", tx: 5, ty: 5, dir: "up" },
      { x: 10, y: 10, to: "gym-tidal", tx: 6, ty: 10, dir: "up" },
      { x: 25, y: 6, to: "route-3", tx: 1, ty: 8, dir: "right" },
    ],
    signs: [{ x: 13, y: 11, textKey: "story.sign_tidal_gym" }],
    npcs: [
      { id: "tidal-girl", x: 8, y: 7, dir: "down", palette: "girl", dialogKeys: ["story.npc_tidal1"] },
      { id: "tidal-old", x: 20, y: 7, dir: "left", palette: "oldman", dialogKeys: ["story.npc_tidal2"] },
    ],
    items: [],
  },

  // ========================================================= TIDAL CENTER
  "tidal-center": {
    id: "tidal-center",
    nameKey: "story.sign_tidal",
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
    warps: [{ x: 6, y: 5, to: "tidal-town", tx: 5, ty: 5, dir: "down" }],
    signs: [],
    npcs: [{ id: "nurse2", x: 5, y: 1, dir: "down", palette: "nurse", script: "nurse" }],
    items: [],
  },

  // ========================================================= TIDAL MART
  "tidal-mart": {
    id: "tidal-mart",
    nameKey: "story.sign_tidal",
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
    warps: [{ x: 5, y: 5, to: "tidal-town", tx: 19, ty: 5, dir: "down" }],
    signs: [],
    npcs: [{ id: "clerk2", x: 3, y: 2, dir: "down", palette: "clerk", script: "mart" }],
    items: [],
  },

  // ========================================================= TIDAL GYM (water)
  "gym-tidal": {
    id: "gym-tidal",
    nameKey: "story.sign_tidal_gym",
    music: "gym",
    indoor: true,
    grid: [
      "IIIIIIIIIIII",
      "IFF~~FF~~FFI",
      "IFF~~FF~~FFI",
      "IFFFFFFFFFFI",
      "I~~FF~~FF~~I",
      "I~~FF~~FF~~I",
      "IFFFFFFFFFFI",
      "IFF~~FF~~FFI",
      "IFF~~FF~~FFI",
      "IFFFFFFFFFFI",
      "IFFFFFFFFFFI",
      "IFFFFFmFFFFI",
      "IIIIIIIIIIII",
    ],
    warps: [{ x: 6, y: 11, to: "tidal-town", tx: 10, ty: 11, dir: "down" }],
    signs: [],
    npcs: [
      { id: "gym2-swimmer", x: 3, y: 6, dir: "down", palette: "lass", trainer: {
        id: "gym2swim", nameKey: "story.tn.swimmer1", preKey: "story.trainer_swimmer1_pre",
        loseKey: "story.trainer_swimmer1_lose", team: [{ speciesId: 72, level: 15 }], prize: 450,
      } },
      { id: "gym2-leader", x: 5, y: 3, dir: "down", palette: "leader", trainer: TRAINERS.gym2 },
    ],
    items: [],
  },

  // ========================================================= ROUTE 3 (east, electric)
  "route-3": {
    id: "route-3",
    nameKey: "story.sign_route3",
    music: "route",
    grid: [
      "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
      "T..............................T",
      "T..ggg....ggg.......ggg........T",
      "T..ggg....ggg.......ggg........T",
      "T..ggg....ggg.......ggg........T",
      "T..............................T",
      "T.....s........................T",
      "T..............................T",
      ",,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,",
      "T..............................T",
      "T....ggg.........ggg...........T",
      "T....ggg.........ggg...........T",
      "T....ggg.........ggg...........T",
      "T..f.......................f...T",
      "T..............................T",
      "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
    ],
    warps: [
      { x: 0, y: 8, to: "tidal-town", tx: 24, ty: 6, dir: "left" },
      { x: 31, y: 8, to: "thunder-city", tx: 1, ty: 7, dir: "right" },
    ],
    signs: [{ x: 6, y: 6, textKey: "story.sign_route3" }],
    npcs: [
      { id: "tr-rocker1", x: 12, y: 7, dir: "down", palette: "bugcatcher", trainer: TRAINERS.rocker1 },
      { id: "tr-picnic1", x: 22, y: 9, dir: "up", palette: "girl", trainer: TRAINERS.picnic1 },
      {
        id: "tr-aurorag1", x: 18, y: 8, dir: "left", palette: "rival",
        trainer: TRAINERS.aurorag1, ifNotFlag: "tr:aurorag1",
      },
      { id: "r3-boy", x: 8, y: 9, dir: "up", palette: "boy", dialogKeys: ["story.npc_route3a"] },
    ],
    items: [
      { x: 4, y: 13, item: "super-potion", qty: 2, flag: "item:r3-sp" },
      { x: 28, y: 2, item: "paralyze-heal", qty: 2, flag: "item:r3-ph" },
      { x: 26, y: 13, item: "tm-9", qty: 1, flag: "item:r3-tm9" },
    ],
    encounters: {
      rate: 0.13,
      table: [
        [25, 20, 16, 19], [81, 25, 16, 19], [100, 20, 16, 19], [56, 15, 16, 18], [19, 20, 16, 18],
      ],
    },
  },

  // ========================================================= THUNDER CITY
  "thunder-city": {
    id: "thunder-city",
    nameKey: "story.sign_thunder",
    music: "thunder",
    grid: [
      "TTTTTTTTTTTT,,TTTTTTTTTTTT",
      "T........................T",
      "T..GGGGGGG......RRRRR....T",
      "T..GGGGGGG......RRRRR....T",
      "T..GGGGGGG......RRRRR....T",
      "T..WwwDwwW......WwDwW....T",
      "T.....,...........,......T",
      ",,,,,,,,,,,,,,,,,,,,,,,,,T",
      "T..BBBBB......BBBBB......T",
      "T..BBBBB......BBBBB......T",
      "T..WwDwW......WwDwW......T",
      "T....,..........,........T",
      "T,,,,,,,,,,,,,,,,,,,,,,,,T",
      "T........s...............T",
      "T..ff..............ff....T",
      "T........................T",
      "T........CCCCC...........T",
      "T........CC-CC...........T",
      "T........................T",
      "TTTTTTTTTTTTTTTTTTTTTTTTTT",
    ],
    warps: [
      { x: 12, y: 0, to: "route-4", tx: 8, ty: 24, dir: "up" },
      { x: 13, y: 0, to: "route-4", tx: 9, ty: 24, dir: "up" },
      { x: 0, y: 7, to: "route-3", tx: 30, ty: 8, dir: "left" },
      { x: 6, y: 5, to: "gym-thunder", tx: 6, ty: 9, dir: "up" },
      { x: 18, y: 5, to: "thunder-center", tx: 6, ty: 4, dir: "up" },
      { x: 5, y: 10, to: "thunder-mart", tx: 5, ty: 4, dir: "up" },
      {
        x: 11, y: 17, to: "aurora-hideout", tx: 7, ty: 9, dir: "up",
        ifFlag: "tr:aurorag2", lockedKey: "story.hideout_locked",
      },
    ],
    signs: [{ x: 9, y: 13, textKey: "story.sign_thunder" }],
    npcs: [
      { id: "th-boy", x: 16, y: 6, dir: "down", palette: "boy", dialogKeys: ["story.npc_thunder1"] },
      { id: "th-old", x: 7, y: 14, dir: "right", palette: "oldman", dialogKeys: ["story.npc_thunder2"] },
    ],
    items: [],
  },

  // ========================================================= THUNDER CENTER / MART
  "thunder-center": {
    id: "thunder-center",
    nameKey: "story.sign_thunder",
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
    warps: [{ x: 6, y: 5, to: "thunder-city", tx: 18, ty: 6, dir: "down" }],
    signs: [],
    npcs: [{ id: "nurse3", x: 5, y: 1, dir: "down", palette: "nurse", script: "nurse" }],
    items: [],
  },
  "thunder-mart": {
    id: "thunder-mart",
    nameKey: "story.sign_thunder",
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
    warps: [{ x: 5, y: 5, to: "thunder-city", tx: 5, ty: 11, dir: "down" }],
    signs: [],
    npcs: [{ id: "clerk3", x: 3, y: 2, dir: "down", palette: "clerk", script: "mart" }],
    items: [],
  },

  // ========================================================= THUNDER GYM (barrier puzzle)
  "gym-thunder": {
    id: "gym-thunder",
    nameKey: "story.sign_gym3",
    music: "gym",
    indoor: true,
    grid: [
      "IIIIIIIIIIII",
      "IFFFFFFFFFFI",
      "IZZZZZZZZZZI",
      "IFFFFFFFFFFI",
      "IFFFFFFFFFFI",
      "IZZZZZZZZZZI",
      "IFFFFFFFFFFI",
      "IFFFFzFFFFFI",
      "IFFFFFFFFFFI",
      "IFFFFFFFFFFI",
      "IFFFFFmFFFFI",
      "IIIIIIIIIIII",
    ],
    warps: [{ x: 6, y: 10, to: "thunder-city", tx: 6, ty: 6, dir: "down" }],
    signs: [],
    npcs: [
      { id: "gym3-leader", x: 5, y: 1, dir: "down", palette: "leader", trainer: TRAINERS.gym3 },
      {
        id: "gym3-rocker", x: 5, y: 4, dir: "down", palette: "bugcatcher",
        trainer: {
          id: "gym3aide", nameKey: "story.tn.rocker1", preKey: "story.trainer_rocker1_pre",
          loseKey: "story.trainer_rocker1_lose",
          team: [{ speciesId: 100, level: 19 }, { speciesId: 81, level: 20 }], prize: 600,
        },
      },
    ],
    items: [],
  },

  // ========================================================= ROUTE 4 (north, flowers)
  "route-4": {
    id: "route-4",
    nameKey: "story.sign_route4",
    music: "route",
    grid: [
      "TTTTTTTT,,TTTTTTTT",
      "T......,,,,......T",
      "T..ff..,,,,..ff..T",
      "T..ff..,,,,..ff..T",
      "T......,,,,......T",
      "T.ggg..,,,,..ggg.T",
      "T.ggg..,,,,..ggg.T",
      "T.ggg..,,,,..ggg.T",
      "T......,,,,......T",
      "T..,,,,,,,,......T",
      "T..,,........s...T",
      "T..,,..ggggg.....T",
      "T..,,..ggggg.....T",
      "T..,,..ggggg.....T",
      "T..,,............T",
      "T..,,,,,,,,......T",
      "T......,,,,......T",
      "T..ff..,,,,..ff..T",
      "T..ff..,,,,..ff..T",
      "T......,,,,......T",
      "T.ggg..,,,,..ggg.T",
      "T.ggg..,,,,..ggg.T",
      "T......,,,,......T",
      "T......,,,,......T",
      "T......,,,,......T",
      "TTTTTTTT,,TTTTTTTT",
    ],
    warps: [
      { x: 8, y: 25, to: "thunder-city", tx: 12, ty: 1, dir: "down" },
      { x: 9, y: 25, to: "thunder-city", tx: 13, ty: 1, dir: "down" },
      { x: 8, y: 0, to: "meadow-town", tx: 10, ty: 14, dir: "up" },
      { x: 9, y: 0, to: "meadow-town", tx: 11, ty: 14, dir: "up" },
    ],
    signs: [{ x: 13, y: 10, textKey: "story.sign_route4" }],
    npcs: [
      { id: "tr-lass2", x: 13, y: 12, dir: "left", palette: "lass", trainer: TRAINERS.lass2 },
      { id: "tr-camper1", x: 5, y: 19, dir: "right", palette: "boy", trainer: TRAINERS.camper1 },
      {
        id: "tr-aurorag2", x: 4, y: 12, dir: "down", palette: "rival",
        trainer: TRAINERS.aurorag2, ifNotFlag: "tr:aurorag2",
      },
      { id: "r4-girl", x: 14, y: 17, dir: "left", palette: "girl", dialogKeys: ["story.npc_route4a"] },
    ],
    items: [
      { x: 14, y: 2, item: "hyper-potion", qty: 1, flag: "item:r4-hp" },
      { x: 2, y: 23, item: "lum-berry", qty: 2, flag: "item:r4-lum" },
      { x: 14, y: 22, item: "tm-76", qty: 1, flag: "item:r4-tm76" },
    ],
    encounters: {
      rate: 0.14,
      table: [
        [43, 22, 18, 21], [69, 22, 18, 21], [191, 16, 18, 20], [187, 15, 18, 20],
        [25, 10, 18, 21], [123, 5, 21, 21], [44, 10, 20, 22],
      ],
    },
  },

  // ========================================================= MEADOW TOWN
  "meadow-town": {
    id: "meadow-town",
    nameKey: "story.sign_meadow",
    music: "town",
    grid: [
      "TTTTTTTTTTTTTTTTTTTTTT",
      "T....................T",
      "T..GGGGG....RRRRR....T",
      "T..GGGGG....RRRRR....T",
      "T..WwDwW....WwDwW....T",
      "T....,.........,.....T",
      "T,,,,,,,,,,,,,,,,,,,,T",
      "T..BBBBB....BBBBB....T",
      "T..BBBBB....BBBBB....T",
      "T..WwDwW....WwDwW....T",
      "T....,.........,.....T",
      "T,,,,,,,,,,,,,,,,,,,,T",
      "T...s................T",
      "T..ff............ff..T",
      "T.........,,.........T",
      "TTTTTTTTTT,,TTTTTTTTTT",
    ],
    warps: [
      { x: 10, y: 15, to: "route-4", tx: 8, ty: 1, dir: "down" },
      { x: 11, y: 15, to: "route-4", tx: 9, ty: 1, dir: "down" },
      { x: 5, y: 4, to: "gym-meadow", tx: 6, ty: 9, dir: "up" },
      { x: 14, y: 4, to: "meadow-center", tx: 6, ty: 4, dir: "up" },
      { x: 5, y: 9, to: "meadow-mart", tx: 5, ty: 4, dir: "up" },
    ],
    signs: [{ x: 4, y: 12, textKey: "story.sign_meadow" }],
    npcs: [
      { id: "md-girl", x: 9, y: 5, dir: "down", palette: "girl", dialogKeys: ["story.npc_meadow1"] },
      { id: "md-old", x: 17, y: 12, dir: "left", palette: "oldman", dialogKeys: ["story.npc_meadow2"] },
    ],
    items: [],
  },
  "meadow-center": {
    id: "meadow-center",
    nameKey: "story.sign_meadow",
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
    warps: [{ x: 6, y: 5, to: "meadow-town", tx: 14, ty: 5, dir: "down" }],
    signs: [],
    npcs: [{ id: "nurse4", x: 5, y: 1, dir: "down", palette: "nurse", script: "nurse" }],
    items: [],
  },
  "meadow-mart": {
    id: "meadow-mart",
    nameKey: "story.sign_meadow",
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
    warps: [{ x: 5, y: 5, to: "meadow-town", tx: 5, ty: 10, dir: "down" }],
    signs: [],
    npcs: [{ id: "clerk4", x: 3, y: 2, dir: "down", palette: "clerk", script: "mart" }],
    items: [],
  },

  // ========================================================= MEADOW GYM (hedge maze)
  "gym-meadow": {
    id: "gym-meadow",
    nameKey: "story.sign_gym4",
    music: "gym",
    indoor: true,
    grid: [
      "IIIIIIIIIIII",
      "IFFFFFFFFFFI",
      "IxxxxxxxxxxI",
      "IFFFFFFFFFFI",
      "IggggFFggggI",
      "IFFFFFFFFFFI",
      "IxxxxxxxxxxI",
      "IFFFFFFFFFFI",
      "IggFFFFFFggI",
      "IFFFFFmFFFFI",
      "IIIIIIIIIIII",
    ],
    warps: [{ x: 6, y: 9, to: "meadow-town", tx: 5, ty: 5, dir: "down" }],
    signs: [],
    npcs: [
      { id: "gym4-leader", x: 5, y: 1, dir: "down", palette: "leader", trainer: TRAINERS.gym4 },
      {
        id: "gym4-camper", x: 5, y: 5, dir: "down", palette: "boy",
        trainer: {
          id: "gym4aide", nameKey: "story.tn.camper1", preKey: "story.trainer_camper1_pre",
          loseKey: "story.trainer_camper1_lose",
          team: [{ speciesId: 70, level: 23 }, { speciesId: 102, level: 23 }], prize: 690,
        },
      },
    ],
    items: [],
  },

  // ========================================================= AURORA HIDEOUT
  "aurora-hideout": {
    id: "aurora-hideout",
    nameKey: "story.sign_hideout",
    music: "cave",
    indoor: true,
    grid: [
      "CCCCCCCCCCCCCCCC",
      "C--------------C",
      "C--CC------CC--C",
      "C--------------C",
      "C----CCCC------C",
      "C--------------C",
      "C--CC------CC--C",
      "C--------------C",
      "C------CC------C",
      "C--------------C",
      "C--------------C",
      "CCCCCCC--CCCCCCC",
    ],
    warps: [
      { x: 7, y: 11, to: "thunder-city", tx: 11, ty: 18, dir: "down" },
      { x: 8, y: 11, to: "thunder-city", tx: 11, ty: 18, dir: "down" },
    ],
    signs: [],
    npcs: [
      {
        id: "tr-aurorag3", x: 5, y: 8, dir: "right", palette: "rival",
        trainer: TRAINERS.aurorag3, ifNotFlag: "tr:aurorag3",
      },
      { id: "aurora-boss", x: 7, y: 2, dir: "down", palette: "oldman", trainer: TRAINERS.auroraboss1 },
    ],
    items: [
      { x: 13, y: 2, item: "ultra-ball", qty: 2, flag: "item:ah-ub" },
      { x: 2, y: 7, item: "revive", qty: 1, flag: "item:ah-rv" },
      { x: 13, y: 9, item: "tm-188", qty: 1, flag: "item:ah-tm188" },
    ],
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
