import type { DexEntry, FlavorMap, Learnsets, MoveData, NameLang } from "../types";

// ---------------------------------------------------------------------------
// Baked-data loaders. Everything is served from /public/data, so the game has
// zero runtime dependency on external APIs. Sprites & cries stream from the
// jsDelivr CDN (mirrors of the official PokeAPI asset repos), which is
// reachable from regions where raw.githubusercontent.com is not.
// ---------------------------------------------------------------------------

const SPRITES = "https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites";
const CRIES = "https://cdn.jsdelivr.net/gh/PokeAPI/cries@main/cries";

export const MAX_DEX_ID = 1025;

export const GEN_RANGES: { gen: number; from: number; to: number; region: string }[] = [
  { gen: 1, from: 1, to: 151, region: "Kanto" },
  { gen: 2, from: 152, to: 251, region: "Johto" },
  { gen: 3, from: 252, to: 386, region: "Hoenn" },
  { gen: 4, from: 387, to: 493, region: "Sinnoh" },
  { gen: 5, from: 494, to: 649, region: "Unova" },
  { gen: 6, from: 650, to: 721, region: "Kalos" },
  { gen: 7, from: 722, to: 809, region: "Alola" },
  { gen: 8, from: 810, to: 905, region: "Galar" },
  { gen: 9, from: 906, to: 1025, region: "Paldea" },
];

export function genOf(id: number): number {
  return GEN_RANGES.find((g) => id >= g.from && id <= g.to)?.gen ?? 1;
}

// --- sprite / audio URLs ----------------------------------------------------

export function spriteFront(id: number, shiny = false): string {
  return `${SPRITES}/pokemon/${shiny ? "shiny/" : ""}${id}.png`;
}
export function spriteBack(id: number, shiny = false): string {
  return `${SPRITES}/pokemon/back/${shiny ? "shiny/" : ""}${id}.png`;
}
/** Animated Gen-5 sprite (exists for ids 1..649); falls back to static. */
export function spriteAnimated(id: number): string {
  return id <= 649
    ? `${SPRITES}/pokemon/versions/generation-v/black-white/animated/${id}.gif`
    : spriteFront(id);
}
export function spriteArtwork(id: number): string {
  return `${SPRITES}/pokemon/other/official-artwork/${id}.png`;
}
/** Tiny box/menu icon. */
export function spriteIcon(id: number): string {
  return `${SPRITES}/pokemon/versions/generation-viii/icons/${id}.png`;
}
export function cryUrl(id: number): string {
  return `${CRIES}/pokemon/latest/${id}.ogg`;
}

// --- data fetching with module-level memoization -----------------------------

function cachedJson<T>(url: string): () => Promise<T> {
  let p: Promise<T> | null = null;
  return () => {
    if (!p) {
      p = fetch(url).then((r) => {
        if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
        return r.json() as Promise<T>;
      }).catch((e) => {
        p = null; // allow retry on transient failure
        throw e;
      });
    }
    return p;
  };
}

export const loadDex = cachedJson<DexEntry[]>("/data/dex.json");
export const loadMoves = cachedJson<MoveData[]>("/data/moves.json");
export const loadLearnsets = cachedJson<Learnsets>("/data/learnsets.json");
export const loadTmsets = cachedJson<Record<string, number[]>>("/data/tmsets.json");
export const loadFlavor = cachedJson<FlavorMap>("/data/flavor.json");

let dexById: Map<number, DexEntry> | null = null;
export async function getDexMap(): Promise<Map<number, DexEntry>> {
  if (!dexById) {
    const list = await loadDex();
    dexById = new Map(list.map((e) => [e.id, e]));
  }
  return dexById;
}
export async function getSpecies(id: number): Promise<DexEntry> {
  const map = await getDexMap();
  const e = map.get(id);
  if (!e) throw new Error(`species ${id} missing from dex.json`);
  return e;
}

let movesById: Map<number, MoveData> | null = null;
export async function getMoveMap(): Promise<Map<number, MoveData>> {
  if (!movesById) {
    const list = await loadMoves();
    movesById = new Map(list.map((m) => [m.id, m]));
  }
  return movesById;
}

// --- localized accessors ------------------------------------------------------

export type Locale = "zh-CN" | "zh-TW" | "en" | "ja" | "ko";

export const LOCALE_TO_NAMELANG: Record<Locale, NameLang> = {
  "zh-CN": "hans",
  "zh-TW": "hant",
  en: "en",
  ja: "ja",
  ko: "ko",
};

export function localName(
  n: Partial<Record<NameLang, string>> | undefined,
  locale: Locale
): string {
  if (!n) return "???";
  const k = LOCALE_TO_NAMELANG[locale];
  return n[k] ?? n.hans ?? n.en ?? Object.values(n)[0] ?? "???";
}

export function dexNo(id: number): string {
  return `#${String(id).padStart(4, "0")}`;
}
