/**
 * Procedural pixel tileset + character sprites. Every tile and sprite is
 * painted with canvas rects at load time — the game ships zero image assets
 * for the world (Pokémon sprites stream from the PokeAPI CDN).
 */

export const TILE = 16;

export enum T {
  GROUND = 0, PATH, TALLGRASS, TREE, TREE_DARK, WATER, FLOWER, ROCK, FENCE, SIGN,
  WALL, ROOF_RED, ROOF_BLUE, ROOF_GRAY, DOOR, WINDOW,
  FLOOR, IWALL, RUG, MAT, TABLE, SHELF, BED, PC, COUNTER, HEALER,
  CAVE_FLOOR, CAVE_WALL, LEDGE, SAND, GYM_FLOOR, STATUE,
  COUNT,
}

export const SOLID = new Set<T>([
  T.TREE, T.TREE_DARK, T.WATER, T.ROCK, T.FENCE, T.SIGN,
  T.WALL, T.ROOF_RED, T.ROOF_BLUE, T.ROOF_GRAY, T.WINDOW,
  T.IWALL, T.TABLE, T.SHELF, T.BED, T.PC, T.COUNTER, T.HEALER,
  T.CAVE_WALL, T.STATUE,
]);

/** Tiles that can trigger a wild encounter when stepped on. */
export const ENCOUNTER_TILES = new Set<T>([T.TALLGRASS]);

// deterministic per-tile noise so speckles don't flicker between frames
function hash(x: number, y: number, s: number): number {
  let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
  h = (h ^ (h >> 13)) | 0;
  h = Math.imul(h, 1274126177);
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

type Ctx = CanvasRenderingContext2D;

function px(c: Ctx, x: number, y: number, w = 1, h = 1) {
  c.fillRect(x, y, w, h);
}

/** Paint one 16×16 tile at (0,0) of ctx (already translated). frame ∈ {0,1}. */
function paintTile(c: Ctx, t: T, frame: number, seed: number) {
  switch (t) {
    case T.GROUND: {
      c.fillStyle = "#7ec850";
      px(c, 0, 0, 16, 16);
      c.fillStyle = "#6fb846";
      for (let i = 0; i < 7; i++) {
        const x = Math.floor(hash(i, seed, 1) * 16);
        const y = Math.floor(hash(seed, i, 2) * 16);
        px(c, x, y, 2, 1);
      }
      break;
    }
    case T.PATH: {
      c.fillStyle = "#e8d8a0";
      px(c, 0, 0, 16, 16);
      c.fillStyle = "#d8c488";
      for (let i = 0; i < 6; i++) {
        const x = Math.floor(hash(i, seed, 3) * 14);
        const y = Math.floor(hash(seed, i, 4) * 14);
        px(c, x, y, 2, 2);
      }
      c.fillStyle = "#c8b478";
      px(c, 0, 0, 16, 1);
      break;
    }
    case T.TALLGRASS: {
      c.fillStyle = "#7ec850";
      px(c, 0, 0, 16, 16);
      c.fillStyle = "#3f9a3f";
      const sway = frame === 0 ? 0 : 1;
      for (let i = 0; i < 4; i++) {
        const bx = i * 4 + (i % 2 === 0 ? sway : -sway);
        px(c, bx, 6, 1, 10);
        px(c, bx + 1, 4, 1, 12);
        px(c, bx + 2, 7, 1, 9);
      }
      c.fillStyle = "#2f7a30";
      for (let i = 0; i < 4; i++) px(c, i * 4 + 1 + sway, 12, 2, 4);
      break;
    }
    case T.TREE: {
      c.fillStyle = "#7ec850";
      px(c, 0, 0, 16, 16);
      c.fillStyle = "#7a4a23";
      px(c, 6, 11, 4, 5);
      c.fillStyle = "#2e8b3d";
      px(c, 2, 2, 12, 10);
      px(c, 1, 4, 14, 6);
      px(c, 4, 0, 8, 4);
      c.fillStyle = "#46b455";
      px(c, 3, 2, 4, 2); px(c, 9, 4, 4, 2); px(c, 5, 7, 3, 2);
      c.fillStyle = "#1d6b2c";
      px(c, 2, 10, 12, 2);
      break;
    }
    case T.TREE_DARK: {
      c.fillStyle = "#3c7a38";
      px(c, 0, 0, 16, 16);
      c.fillStyle = "#5a3a1b";
      px(c, 6, 12, 4, 4);
      c.fillStyle = "#1d5c28";
      px(c, 1, 1, 14, 11);
      px(c, 3, 0, 10, 3);
      c.fillStyle = "#2e7a38";
      px(c, 3, 2, 4, 2); px(c, 9, 5, 4, 2);
      c.fillStyle = "#114420";
      px(c, 1, 10, 14, 2);
      break;
    }
    case T.WATER: {
      c.fillStyle = "#4a90d9";
      px(c, 0, 0, 16, 16);
      c.fillStyle = "#7fb6e8";
      const o = frame === 0 ? 0 : 2;
      px(c, 1 + o, 3, 5, 1); px(c, 9 - o, 7, 5, 1);
      px(c, 3 - o + 2, 11, 5, 1); px(c, 10, 14, 4, 1);
      c.fillStyle = "#3a78c0";
      px(c, 6, 5, 3, 1); px(c, 2, 9, 3, 1); px(c, 11, 12, 3, 1);
      break;
    }
    case T.FLOWER: {
      c.fillStyle = "#7ec850";
      px(c, 0, 0, 16, 16);
      c.fillStyle = "#6fb846";
      px(c, 1, 13, 3, 1); px(c, 11, 2, 3, 1);
      const bloom = frame === 0;
      // red flower
      c.fillStyle = bloom ? "#e84048" : "#f06860";
      px(c, 3, 3, 3, 3);
      c.fillStyle = "#ffd400";
      px(c, 4, 4, 1, 1);
      // yellow flower
      c.fillStyle = bloom ? "#f8c810" : "#ffe060";
      px(c, 10, 9, 3, 3);
      c.fillStyle = "#e85048";
      px(c, 11, 10, 1, 1);
      c.fillStyle = "#3f9a3f";
      px(c, 4, 6, 1, 2); px(c, 11, 12, 1, 2);
      break;
    }
    case T.ROCK: {
      c.fillStyle = "#7ec850";
      px(c, 0, 0, 16, 16);
      c.fillStyle = "#9a8878";
      px(c, 2, 5, 12, 9);
      px(c, 4, 3, 8, 4);
      c.fillStyle = "#bcaa96";
      px(c, 4, 4, 5, 2); px(c, 3, 7, 3, 2);
      c.fillStyle = "#6a5a4c";
      px(c, 2, 12, 12, 2); px(c, 11, 6, 3, 5);
      break;
    }
    case T.FENCE: {
      c.fillStyle = "#7ec850";
      px(c, 0, 0, 16, 16);
      c.fillStyle = "#c8a060";
      px(c, 1, 4, 2, 9); px(c, 7, 4, 2, 9); px(c, 13, 4, 2, 9);
      px(c, 0, 6, 16, 2); px(c, 0, 10, 16, 2);
      c.fillStyle = "#a07840";
      px(c, 1, 12, 2, 1); px(c, 7, 12, 2, 1); px(c, 13, 12, 2, 1);
      break;
    }
    case T.SIGN: {
      c.fillStyle = "#7ec850";
      px(c, 0, 0, 16, 16);
      c.fillStyle = "#8a6a3a";
      px(c, 7, 9, 2, 6);
      c.fillStyle = "#c8a060";
      px(c, 2, 2, 12, 8);
      c.fillStyle = "#8a6a3a";
      px(c, 2, 2, 12, 1); px(c, 2, 9, 12, 1); px(c, 2, 2, 1, 8); px(c, 13, 2, 1, 8);
      c.fillStyle = "#6a4a22";
      px(c, 4, 4, 8, 1); px(c, 4, 6, 6, 1);
      break;
    }
    case T.WALL: {
      c.fillStyle = "#f0e0c0";
      px(c, 0, 0, 16, 16);
      c.fillStyle = "#d8c8a0";
      px(c, 0, 4, 16, 1); px(c, 0, 9, 16, 1); px(c, 0, 14, 16, 1);
      px(c, 5, 0, 1, 4); px(c, 11, 5, 1, 4); px(c, 3, 10, 1, 4);
      c.fillStyle = "#b8a880";
      px(c, 0, 15, 16, 1);
      break;
    }
    case T.ROOF_RED:
    case T.ROOF_BLUE:
    case T.ROOF_GRAY: {
      const base = t === T.ROOF_RED ? "#d04848" : t === T.ROOF_BLUE ? "#4a7fd0" : "#8a93a8";
      const dark = t === T.ROOF_RED ? "#a83038" : t === T.ROOF_BLUE ? "#34589a" : "#646c80";
      const light = t === T.ROOF_RED ? "#e87070" : t === T.ROOF_BLUE ? "#74a0e8" : "#aeb6c8";
      c.fillStyle = base;
      px(c, 0, 0, 16, 16);
      c.fillStyle = dark;
      px(c, 0, 5, 16, 1); px(c, 0, 11, 16, 1);
      c.fillStyle = light;
      px(c, 0, 0, 16, 2);
      break;
    }
    case T.DOOR: {
      c.fillStyle = "#f0e0c0";
      px(c, 0, 0, 16, 16);
      c.fillStyle = "#7a4a23";
      px(c, 2, 1, 12, 15);
      c.fillStyle = "#5c3517";
      px(c, 3, 2, 10, 13);
      c.fillStyle = "#9a6a3a";
      px(c, 4, 3, 8, 5);
      c.fillStyle = "#ffd400";
      px(c, 11, 9, 1, 2);
      break;
    }
    case T.WINDOW: {
      c.fillStyle = "#f0e0c0";
      px(c, 0, 0, 16, 16);
      c.fillStyle = "#8a7a58";
      px(c, 2, 3, 12, 10);
      c.fillStyle = "#9ad8f8";
      px(c, 3, 4, 10, 8);
      c.fillStyle = "#d8f0ff";
      px(c, 4, 5, 3, 2);
      c.fillStyle = "#8a7a58";
      px(c, 7, 4, 1, 8); px(c, 3, 7, 10, 1);
      break;
    }
    case T.FLOOR: {
      c.fillStyle = "#e0c088";
      px(c, 0, 0, 16, 16);
      c.fillStyle = "#d0b078";
      px(c, 0, 3, 16, 1); px(c, 0, 7, 16, 1); px(c, 0, 11, 16, 1); px(c, 0, 15, 16, 1);
      c.fillStyle = "#c8a868";
      px(c, (seed * 5) % 12, 4, 4, 1);
      break;
    }
    case T.GYM_FLOOR: {
      c.fillStyle = "#cfd6e4";
      px(c, 0, 0, 16, 16);
      c.fillStyle = "#b9c2d6";
      px(c, 0, 0, 8, 8); px(c, 8, 8, 8, 8);
      c.fillStyle = "#a3aec8";
      px(c, 0, 15, 16, 1);
      break;
    }
    case T.IWALL: {
      c.fillStyle = "#a8b0c8";
      px(c, 0, 0, 16, 16);
      c.fillStyle = "#8890a8";
      px(c, 0, 10, 16, 6);
      c.fillStyle = "#c8d0e0";
      px(c, 0, 0, 16, 2);
      c.fillStyle = "#788098";
      px(c, 0, 15, 16, 1);
      break;
    }
    case T.RUG: {
      c.fillStyle = "#d04848";
      px(c, 0, 0, 16, 16);
      c.fillStyle = "#e87070";
      px(c, 1, 1, 14, 14);
      c.fillStyle = "#d04848";
      px(c, 3, 3, 10, 10);
      c.fillStyle = "#ffd400";
      px(c, 7, 7, 2, 2);
      break;
    }
    case T.MAT: {
      c.fillStyle = "#e0c088";
      px(c, 0, 0, 16, 16);
      c.fillStyle = "#3f9a3f";
      px(c, 1, 2, 14, 12);
      c.fillStyle = "#56b856";
      px(c, 2, 3, 12, 10);
      c.fillStyle = "#2f7a30";
      px(c, 4, 6, 8, 1); px(c, 4, 9, 8, 1);
      break;
    }
    case T.TABLE: {
      c.fillStyle = "#e0c088";
      px(c, 0, 0, 16, 16);
      c.fillStyle = "#a87848";
      px(c, 1, 3, 14, 9);
      c.fillStyle = "#c89858";
      px(c, 2, 4, 12, 6);
      c.fillStyle = "#7a5a30";
      px(c, 2, 12, 2, 3); px(c, 12, 12, 2, 3);
      break;
    }
    case T.SHELF: {
      c.fillStyle = "#a87848";
      px(c, 0, 0, 16, 16);
      c.fillStyle = "#7a5a30";
      px(c, 1, 1, 14, 6); px(c, 1, 9, 14, 6);
      const cols = ["#e85048", "#4a7fd0", "#56b856", "#f8c810", "#a85ab8"];
      for (let i = 0; i < 5; i++) {
        c.fillStyle = cols[Math.floor(hash(i, seed, 7) * cols.length)];
        px(c, 2 + i * 2.5, 2, 2, 5);
        c.fillStyle = cols[Math.floor(hash(seed, i, 8) * cols.length)];
        px(c, 2 + i * 2.5, 10, 2, 5);
      }
      break;
    }
    case T.BED: {
      c.fillStyle = "#e0c088";
      px(c, 0, 0, 16, 16);
      c.fillStyle = "#b04848";
      px(c, 2, 1, 12, 14);
      c.fillStyle = "#e87070";
      px(c, 3, 2, 10, 12);
      c.fillStyle = "#f8f8f8";
      px(c, 3, 2, 10, 4);
      c.fillStyle = "#d8d8e8";
      px(c, 3, 5, 10, 1);
      break;
    }
    case T.PC: {
      c.fillStyle = "#e0c088";
      px(c, 0, 0, 16, 16);
      c.fillStyle = "#8890a8";
      px(c, 2, 2, 12, 11);
      c.fillStyle = frame === 0 ? "#58d858" : "#40b8e8";
      px(c, 4, 4, 8, 6);
      c.fillStyle = "#586078";
      px(c, 5, 13, 6, 2);
      break;
    }
    case T.COUNTER: {
      c.fillStyle = "#c89858";
      px(c, 0, 0, 16, 16);
      c.fillStyle = "#e0b878";
      px(c, 0, 0, 16, 6);
      c.fillStyle = "#a87848";
      px(c, 0, 6, 16, 2);
      c.fillStyle = "#8a6038";
      px(c, 0, 14, 16, 2);
      break;
    }
    case T.HEALER: {
      c.fillStyle = "#e0c088";
      px(c, 0, 0, 16, 16);
      c.fillStyle = "#c0c8d8";
      px(c, 1, 4, 14, 11);
      c.fillStyle = "#9aa2b8";
      px(c, 2, 5, 12, 9);
      const lit = frame === 0;
      for (let i = 0; i < 3; i++) {
        c.fillStyle = (i + (lit ? 0 : 1)) % 2 === 0 ? "#e85048" : "#58d858";
        px(c, 4 + i * 3, 7, 2, 2);
      }
      c.fillStyle = "#f8f8f8";
      px(c, 4, 11, 8, 2);
      break;
    }
    case T.CAVE_FLOOR: {
      c.fillStyle = "#9a8878";
      px(c, 0, 0, 16, 16);
      c.fillStyle = "#8a7868";
      for (let i = 0; i < 6; i++) {
        px(c, Math.floor(hash(i, seed, 9) * 14), Math.floor(hash(seed, i, 10) * 14), 2, 2);
      }
      break;
    }
    case T.CAVE_WALL: {
      c.fillStyle = "#5a4a48";
      px(c, 0, 0, 16, 16);
      c.fillStyle = "#6e5c58";
      px(c, 0, 0, 16, 3);
      px(c, 2, 5, 4, 3); px(c, 9, 8, 4, 3);
      c.fillStyle = "#433534";
      px(c, 0, 13, 16, 3);
      break;
    }
    case T.LEDGE: {
      c.fillStyle = "#7ec850";
      px(c, 0, 0, 16, 16);
      c.fillStyle = "#c8a060";
      px(c, 0, 10, 16, 4);
      c.fillStyle = "#8a6a3a";
      px(c, 0, 13, 16, 2);
      c.fillStyle = "#6fb846";
      px(c, 0, 15, 16, 1);
      break;
    }
    case T.SAND: {
      c.fillStyle = "#ead9a6";
      px(c, 0, 0, 16, 16);
      c.fillStyle = "#dcc890";
      for (let i = 0; i < 5; i++) {
        px(c, Math.floor(hash(i, seed, 11) * 14), Math.floor(hash(seed, i, 12) * 14), 2, 1);
      }
      break;
    }
    case T.STATUE: {
      c.fillStyle = "#cfd6e4";
      px(c, 0, 0, 16, 16);
      c.fillStyle = "#8a93a8";
      px(c, 4, 2, 8, 10);
      px(c, 3, 12, 10, 3);
      c.fillStyle = "#aeb6c8";
      px(c, 5, 3, 3, 3);
      c.fillStyle = "#646c80";
      px(c, 4, 10, 8, 2);
      break;
    }
  }
}

let atlas: HTMLCanvasElement | null = null;

/** Build (once) a 2-frame atlas: row 0 = frame A, row 1 = frame B. */
export function getAtlas(): HTMLCanvasElement {
  if (atlas) return atlas;
  const cv = document.createElement("canvas");
  cv.width = T.COUNT * TILE;
  cv.height = 2 * TILE;
  const c = cv.getContext("2d")!;
  for (let f = 0; f < 2; f++) {
    for (let t = 0; t < T.COUNT; t++) {
      c.save();
      c.translate(t * TILE, f * TILE);
      c.beginPath();
      c.rect(0, 0, TILE, TILE);
      c.clip();
      paintTile(c, t as T, f, t * 31 + 7);
      c.restore();
    }
  }
  atlas = cv;
  return cv;
}

export function drawTile(ctx: Ctx, t: T, frame: 0 | 1, dx: number, dy: number) {
  ctx.drawImage(getAtlas(), t * TILE, frame * TILE, TILE, TILE, dx, dy, TILE, TILE);
}

// ---------------------------------------------------------------------------
// Character sprites from pixel templates
// ---------------------------------------------------------------------------

export interface CharPalette {
  hair: string;  // or hat
  skin: string;
  shirt: string;
  pants: string;
  accent?: string;
}

export const PALETTES: Record<string, CharPalette> = {
  hero:      { hair: "#e3350d", skin: "#f8c890", shirt: "#3466af", pants: "#384058", accent: "#f8f8f8" },
  rival:     { hair: "#7048a8", skin: "#f8c890", shirt: "#384058", pants: "#6a4a22", accent: "#f8f8f8" },
  professor: { hair: "#8a8a8a", skin: "#f0c8a0", shirt: "#f0f0f0", pants: "#6a5a40", accent: "#c0c0c0" },
  mom:       { hair: "#a8683a", skin: "#f8d0a8", shirt: "#e88098", pants: "#f0e8d8", accent: "#f8f8f8" },
  nurse:     { hair: "#f088a8", skin: "#f8d0a8", shirt: "#f8f0f0", pants: "#f8b8c8", accent: "#e3350d" },
  clerk:     { hair: "#4a4a58", skin: "#f0c8a0", shirt: "#4a90d9", pants: "#384058", accent: "#f8f8f8" },
  boy:       { hair: "#6a4a22", skin: "#f8c890", shirt: "#56b856", pants: "#8a6a3a", accent: "#f8f8f8" },
  girl:      { hair: "#c89838", skin: "#f8d0a8", shirt: "#e85048", pants: "#f8f8f8", accent: "#f8f8f8" },
  oldman:    { hair: "#d8d8d8", skin: "#e8b888", shirt: "#787888", pants: "#585868", accent: "#f8f8f8" },
  leader:    { hair: "#6a4a22", skin: "#e8b070", shirt: "#b6a136", pants: "#5a4a48", accent: "#f8f8f8" },
  bugcatcher:{ hair: "#3a3a3a", skin: "#f8c890", shirt: "#f8e858", pants: "#5878c8", accent: "#f8f8f8" },
  lass:      { hair: "#5878c8", skin: "#f8d0a8", shirt: "#78c8f0", pants: "#3a5aa8", accent: "#f8f8f8" },
};

// 12×16 templates. chars: . none, h hair, k skin, e eye, s shirt, p pants, o shoe, a accent
const TPL_DOWN_A = [
  "............",
  "...hhhhhh...",
  "..hhhhhhhh..",
  ".hhhhhhhhhh.",
  ".hhkkkkkkhh.",
  "..kkkkkkkk..",
  "..kekkkkek..",
  "..kkkkkkkk..",
  "...ssssss...",
  ".sssssssssss".slice(0, 12),
  ".kssssssssk.",
  "..ssssssss..",
  "..pppppppp..",
  "..ppp..ppp..",
  "..oo....oo..",
  "............",
];
const TPL_DOWN_B = [
  "............",
  "...hhhhhh...",
  "..hhhhhhhh..",
  ".hhhhhhhhhh.",
  ".hhkkkkkkhh.",
  "..kkkkkkkk..",
  "..kekkkkek..",
  "..kkkkkkkk..",
  "...ssssss...",
  ".kssssssss..",
  "..ssssssssk.",
  "..ssssssss..",
  "..pppppppp..",
  "...ppp.ppp..",
  "...oo...oo..",
  "............",
];
const TPL_UP_A = [
  "............",
  "...hhhhhh...",
  "..hhhhhhhh..",
  ".hhhhhhhhhh.",
  ".hhhhhhhhhh.",
  "..hhhhhhhh..",
  "..hhhhhhhh..",
  "..kkhhhhkk..",
  "...ssssss...",
  ".ssssssssss.",
  ".kssssssssk.",
  "..ssssssss..",
  "..pppppppp..",
  "..ppp..ppp..",
  "..oo....oo..",
  "............",
];
const TPL_UP_B = TPL_UP_A.map((r, i) =>
  i === 13 ? "...ppp.ppp.." : i === 14 ? "...oo...oo.." : r
);
const TPL_SIDE_A = [
  "............",
  "....hhhhh...",
  "...hhhhhhh..",
  "..hhhhhhhh..",
  "..hhkkkkkh..",
  "...kkkkkk...",
  "...kkekkk...",
  "...kkkkkk...",
  "....ssss....",
  "...ssssss...",
  "...sssssk...",
  "...ssssss...",
  "...pppppp...",
  "...ppp.pp...",
  "...oo..oo...",
  "............",
];
const TPL_SIDE_B = TPL_SIDE_A.map((r, i) =>
  i === 13 ? "....pppp...." : i === 14 ? "....oooo...." : r
);

const charCache = new Map<string, HTMLCanvasElement>();

/** dir: 0 down, 1 up, 2 left, 3 right; frame 0/1 */
export function getCharSprite(paletteKey: string, dir: number, frame: number): HTMLCanvasElement {
  const key = `${paletteKey}:${dir}:${frame}`;
  const hit = charCache.get(key);
  if (hit) return hit;
  const pal = PALETTES[paletteKey] ?? PALETTES.hero;
  const tpl =
    dir === 0 ? (frame ? TPL_DOWN_B : TPL_DOWN_A)
    : dir === 1 ? (frame ? TPL_UP_B : TPL_UP_A)
    : (frame ? TPL_SIDE_B : TPL_SIDE_A);
  const cv = document.createElement("canvas");
  cv.width = 16; cv.height = 16;
  const c = cv.getContext("2d")!;
  const colors: Record<string, string> = {
    h: pal.hair, k: pal.skin, e: "#222233", s: pal.shirt, p: pal.pants,
    o: "#33303a", a: pal.accent ?? "#ffffff",
  };
  const flip = dir === 3;
  for (let y = 0; y < 16; y++) {
    const row = tpl[y];
    for (let x = 0; x < 12; x++) {
      const ch = row[x];
      if (!ch || ch === ".") continue;
      c.fillStyle = colors[ch] ?? "#000";
      const dx = flip ? 16 - (x + 2) - 1 : x + 2;
      c.fillRect(dx, y, 1, 1);
    }
  }
  charCache.set(key, cv);
  return cv;
}
