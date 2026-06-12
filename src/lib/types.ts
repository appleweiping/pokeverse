// ---------------------------------------------------------------------------
// Shared domain types for PokéVerse (dex data, battle state, save files)
// ---------------------------------------------------------------------------

export type TypeName =
  | "normal" | "fire" | "water" | "electric" | "grass" | "ice"
  | "fighting" | "poison" | "ground" | "flying" | "psychic" | "bug"
  | "rock" | "ghost" | "dragon" | "dark" | "steel" | "fairy";

export const ALL_TYPES: TypeName[] = [
  "normal", "fire", "water", "electric", "grass", "ice",
  "fighting", "poison", "ground", "flying", "psychic", "bug",
  "rock", "ghost", "dragon", "dark", "steel", "fairy",
];

/** Language keys as stored in baked data files. */
export type NameLang = "hans" | "hant" | "en" | "ja" | "ko";
export type LocalName = Partial<Record<NameLang, string>>;

export interface EvoEdge {
  to: number;
  lv?: number;
  item?: string;
  trade?: 1;
  hap?: number;
  other?: 1;
}

/** One species entry in dex.json (field names match the baker). */
export interface DexEntry {
  id: number;
  n: LocalName;
  g: LocalName; // genus, e.g. "Seed Pokémon"
  t: TypeName[];
  /** base stats: [hp, atk, def, spa, spd, spe] */
  s: [number, number, number, number, number, number];
  h: number; // height, decimeters
  w: number; // weight, hectograms
  be: number; // base experience
  gr: number; // growth rate index (see formulas.ts)
  cr: number; // capture rate
  ab?: string[]; // ability slugs; hidden ability prefixed with "!"
  gen?: number; // gender rate: -1 genderless, else female ratio in eighths
  evo?: EvoEdge[];
  /** EV yield, sparse [[statIdx, amount], ...] */
  ey?: [number, number][];
}

export type Weather = "none" | "sun" | "rain" | "sand" | "hail";

export interface MoveMeta {
  ail?: string;
  ailCh?: number;
  st?: [string, number][];
  stCh?: number;
  drain?: number;   // % of damage dealt, negative = recoil
  heal?: number;    // % of max HP healed
  flinch?: number;
  crit?: number;
  hits?: [number, number];
  tgt?: string;
}

export interface MoveData {
  id: number;
  n: LocalName;
  t: TypeName;
  /** 0 = physical, 1 = special, 2 = status */
  c: 0 | 1 | 2;
  p: number;  // power (0 for status)
  a: number;  // accuracy (0 = never misses)
  pp: number;
  pr: number; // priority
  m?: MoveMeta;
}

export type Learnsets = Record<string, [number, number][]>; // id -> [[level, moveId]]
export type FlavorMap = Record<string, LocalName>;

// ---------------------------------------------------------------------------
// Owned Pokémon / battle
// ---------------------------------------------------------------------------

export type MajorStatus = "par" | "brn" | "psn" | "tox" | "slp" | "frz";

export interface MonMove {
  id: number;
  pp: number;
  maxPp: number;
}

/** A caught Pokémon — fully serializable into the save file. */
export interface Mon {
  uid: string;
  speciesId: number;
  level: number;
  exp: number;
  ivs: [number, number, number, number, number, number];
  /** effort values, [hp,atk,def,spa,spd,spe]; absent on pre-v0.5 saves */
  evs?: [number, number, number, number, number, number];
  nature: number; // index into NATURES
  moves: MonMove[];
  curHP: number;
  status: MajorStatus | null;
  shiny: boolean;
  nickname?: string;
  ball: string;
  ot: string; // original trainer name
  ability?: string; // resolved ability slug (chosen at creation)
  item?: string | null; // held item id (berries etc.)
  gender?: "m" | "f" | "n";
}

export type StatStageKey = "atk" | "def" | "spa" | "spd" | "spe" | "acc" | "eva";

// ---------------------------------------------------------------------------
// World / save
// ---------------------------------------------------------------------------

export type Dir = "up" | "down" | "left" | "right";

export interface SaveData {
  version: number;
  playerName: string;
  trainerId: string;
  mapId: string;
  x: number;
  y: number;
  dir: Dir;
  party: Mon[];
  box: Mon[];
  bag: Record<string, number>;
  money: number;
  badges: string[];
  flags: Record<string, number | string>;
  dexSeen: number[];
  dexCaught: number[];
  playSeconds: number;
  savedAt: number;
  /** lifetime counters for achievements */
  stats?: Record<string, number>;
  /** unlocked achievement ids */
  achievements?: string[];
  /** champion victory record */
  hallOfFame?: { date: number; team: { speciesId: number; level: number }[] };
}

export interface ItemDef {
  id: string;
  category: "ball" | "medicine" | "battle" | "key" | "berry" | "hold" | "tm";
  price: number;
  /** technical machine: teaches this move id */
  tmMove?: number;
  /** ball catch-rate multiplier */
  ballMult?: number;
  /** flat HP restored */
  heal?: number;
  /** revive fraction (0.5 = half HP) */
  revive?: number;
  /** cures these statuses ("all" = full heal) */
  cure?: MajorStatus[] | "all";
  /** evolution stone item name (matches PokeAPI item names) */
  evoItem?: string;
  /** held berry: auto-trigger in battle */
  berry?: {
    /** restore HP when HP drops below this fraction */
    healBelow?: number;
    healAmount?: number;     // flat HP, or...
    healFraction?: number;   // fraction of max HP
    /** cure this status automatically */
    cureStatus?: MajorStatus[] | "all";
    /** halve super-effective damage of this type once */
    resistBerry?: TypeName;
  };
}
