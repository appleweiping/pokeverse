/**
 * Procedural pixel tileset + character sprites — v2 "GBA authentic" pass.
 *
 * Art direction follows the FireRed/LeafGreen look: dark outlines around
 * objects, 2-3 tone shading per material, saturated greens, chibi character
 * proportions (16×20 sprites, big head / small body). Everything is painted
 * with canvas rects at load time — the game ships zero image assets.
 */

export const TILE = 16;
/** character sprites are 16 wide × 20 tall, anchored to the tile's bottom */
export const SPRITE_H = 20;

export enum T {
  GROUND = 0, PATH, TALLGRASS, TREE, TREE_DARK, WATER, FLOWER, ROCK, FENCE, SIGN,
  WALL, ROOF_RED, ROOF_BLUE, ROOF_GRAY, DOOR, WINDOW,
  FLOOR, IWALL, RUG, MAT, TABLE, SHELF, BED, PC, COUNTER, HEALER,
  CAVE_FLOOR, CAVE_WALL, LEDGE, SAND, GYM_FLOOR, STATUE,
  CUT_TREE, ROCK_SMASH,
  COUNT,
}

export const SOLID = new Set<T>([
  T.TREE, T.TREE_DARK, T.WATER, T.ROCK, T.FENCE, T.SIGN,
  T.WALL, T.ROOF_RED, T.ROOF_BLUE, T.ROOF_GRAY, T.WINDOW,
  T.IWALL, T.TABLE, T.SHELF, T.BED, T.PC, T.COUNTER, T.HEALER,
  T.CAVE_WALL, T.STATUE, T.CUT_TREE, T.ROCK_SMASH,
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

// ---------------------------------------------------------------- palette

// FRLG-inspired master palette
const P = {
  outline: "#1a1c24",
  grass: "#70c050", grassDk: "#5cab40", grassLt: "#84d264",
  tuft: "#2e8a38", tuftMid: "#46a848",
  treeLt: "#54b85c", treeMd: "#2f9040", treeDk: "#1d6630", treeOut: "#143820",
  trunk: "#9a6234", trunkDk: "#6e421e",
  water: "#4090e0", waterLt: "#8cc4f0", waterDk: "#2b6cc0",
  path: "#ecdca8", pathDk: "#d8c488", pathLt: "#f6ecc4",
  sand: "#f0e2b0", sandDk: "#dcc890",
  rock: "#b0a088", rockLt: "#d0c4ac", rockDk: "#7c6c54",
  wood: "#c89858", woodLt: "#e0bc80", woodDk: "#946c38",
  wall: "#f4e8cc", wallDk: "#d8c8a4", wallShadow: "#b8a884",
  roofRed: "#d84848", roofRedLt: "#f07868", roofRedDk: "#9c2c34",
  roofBlue: "#4880d8", roofBlueLt: "#78a8f0", roofBlueDk: "#2c549c",
  roofGray: "#98a0b4", roofGrayLt: "#c0c8d8", roofGrayDk: "#646c84",
  floor: "#e8c890", floorDk: "#d4b074", floorLt: "#f4dcae",
  iwall: "#b0b8cc", iwallLt: "#d0d8e8", iwallDk: "#808aa4",
  caveF: "#a08870", caveFDk: "#8a7258", caveW: "#5c4636", caveWLt: "#79604a", caveWDk: "#3c2c20",
  gym: "#d4dceb", gymDk: "#b8c2d8",
};

// ---------------------------------------------------------------- tiles

/** Paint one 16×16 tile at (0,0) of ctx (already translated). frame ∈ {0,1}. */
function paintTile(c: Ctx, t: T, frame: number, seed: number) {
  switch (t) {
    case T.GROUND: {
      c.fillStyle = P.grass;
      px(c, 0, 0, 16, 16);
      // FRLG-style staggered grass dashes
      c.fillStyle = P.grassDk;
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 2; col++) {
          const ox = col * 8 + (row % 2 === 0 ? 1 : 5);
          const oy = row * 4 + 1 + Math.floor(hash(col, row, seed) * 2);
          px(c, ox, oy, 2, 1);
          px(c, ox + 3, oy + 1, 1, 1);
        }
      }
      c.fillStyle = P.grassLt;
      px(c, Math.floor(hash(seed, 1, 2) * 13), Math.floor(hash(2, seed, 3) * 13), 1, 1);
      px(c, Math.floor(hash(seed, 4, 5) * 13), Math.floor(hash(5, seed, 6) * 13), 1, 1);
      break;
    }
    case T.PATH: {
      c.fillStyle = P.path;
      px(c, 0, 0, 16, 16);
      c.fillStyle = P.pathDk;
      for (let i = 0; i < 5; i++) {
        const x = Math.floor(hash(i, seed, 3) * 13);
        const y = Math.floor(hash(seed, i, 4) * 13);
        px(c, x, y, 2, 1);
        px(c, x + 1, y + 1, 1, 1);
      }
      c.fillStyle = P.pathLt;
      px(c, Math.floor(hash(seed, 7, 8) * 12), Math.floor(hash(8, seed, 9) * 12), 2, 1);
      break;
    }
    case T.TALLGRASS: {
      // grass base
      c.fillStyle = P.grass;
      px(c, 0, 0, 16, 16);
      c.fillStyle = P.grassDk;
      px(c, 2, 13, 3, 1); px(c, 10, 14, 3, 1);
      const sway = frame === 0 ? 0 : 1;
      // three V-shaped tufts, FRLG style
      for (let i = 0; i < 3; i++) {
        const bx = 1 + i * 5 + (i === 1 ? sway : -sway);
        const by = 3 + (i % 2) * 2;
        // dark blades
        c.fillStyle = P.tuft;
        px(c, bx, by + 2, 1, 8); px(c, bx + 4, by + 2, 1, 8);
        px(c, bx + 1, by, 1, 10); px(c, bx + 3, by, 1, 10);
        px(c, bx + 2, by + 3, 1, 8);
        // mid highlights
        c.fillStyle = P.tuftMid;
        px(c, bx + 1, by + 1, 1, 4); px(c, bx + 3, by + 1, 1, 4);
      }
      break;
    }
    case T.TREE:
    case T.TREE_DARK: {
      const dark = t === T.TREE_DARK;
      // backdrop
      c.fillStyle = dark ? "#1d6630" : P.grass;
      px(c, 0, 0, 16, 16);
      // trunk
      c.fillStyle = P.trunkDk;
      px(c, 6, 12, 4, 4);
      c.fillStyle = P.trunk;
      px(c, 7, 12, 2, 4);
      // canopy outline
      c.fillStyle = P.treeOut;
      px(c, 2, 1, 12, 2); px(c, 1, 2, 14, 10); px(c, 3, 0, 10, 2);
      // canopy body: dark lower, mid upper
      c.fillStyle = dark ? "#174d28" : P.treeDk;
      px(c, 2, 6, 12, 5);
      c.fillStyle = dark ? "#1f6132" : P.treeMd;
      px(c, 2, 2, 12, 5); px(c, 4, 1, 8, 2);
      // light cap + leaf highlights
      c.fillStyle = dark ? "#2a7a40" : P.treeLt;
      px(c, 4, 1, 5, 2); px(c, 3, 3, 3, 2); px(c, 9, 2, 3, 2);
      c.fillStyle = dark ? "#39964e" : "#7ed87e";
      px(c, 5, 2, 2, 1); px(c, 10, 3, 1, 1); px(c, 4, 5, 1, 1);
      // canopy bottom shadow over trunk
      c.fillStyle = P.treeOut;
      px(c, 4, 10, 8, 2);
      break;
    }
    case T.WATER: {
      c.fillStyle = P.water;
      px(c, 0, 0, 16, 16);
      const o = frame === 0 ? 0 : 2;
      // light wave crests (animated)
      c.fillStyle = P.waterLt;
      px(c, 1 + o, 2, 4, 1); px(c, 5 + o, 3, 1, 1);
      px(c, 9 - o, 7, 4, 1); px(c, 13 - o, 8, 1, 1);
      px(c, 3 + o, 12, 4, 1); px(c, 7 + o, 13, 1, 1);
      // dark troughs
      c.fillStyle = P.waterDk;
      px(c, 8 + o, 4, 3, 1); px(c, 2 - (o ? 1 : 0) + 1, 9, 3, 1); px(c, 11 - o, 14, 3, 1);
      // sparkle
      if (frame === 1) { c.fillStyle = "#e8f6ff"; px(c, 12, 2, 1, 1); }
      break;
    }
    case T.FLOWER: {
      c.fillStyle = P.grass;
      px(c, 0, 0, 16, 16);
      c.fillStyle = P.grassDk;
      px(c, 1, 13, 3, 1); px(c, 11, 2, 3, 1);
      const open = frame === 0;
      // FRLG white-petaled red flower (animates petal spread)
      const flower = (fx: number, fy: number, core: string) => {
        c.fillStyle = "#f8f8f8";
        if (open) {
          px(c, fx + 1, fy, 2, 1); px(c, fx, fy + 1, 1, 2); px(c, fx + 3, fy + 1, 1, 2); px(c, fx + 1, fy + 3, 2, 1);
        } else {
          px(c, fx + 1, fy, 2, 1); px(c, fx + 1, fy + 3, 2, 1); px(c, fx, fy + 1, 1, 2); px(c, fx + 3, fy + 1, 1, 2);
          c.fillStyle = "#e0e0e0";
          px(c, fx + 1, fy + 1, 2, 2);
        }
        c.fillStyle = core;
        px(c, fx + 1, fy + 1, 2, 2);
        // stem
        c.fillStyle = P.tuft;
        px(c, fx + 1, fy + 4, 1, 2);
      };
      flower(3, 3, "#e84048");
      flower(10, 8, "#f8c818");
      break;
    }
    case T.ROCK: {
      c.fillStyle = P.grass;
      px(c, 0, 0, 16, 16);
      c.fillStyle = P.outline;
      px(c, 2, 4, 12, 10); px(c, 4, 2, 8, 3);
      c.fillStyle = P.rock;
      px(c, 3, 5, 10, 8); px(c, 5, 3, 6, 3);
      c.fillStyle = P.rockLt;
      px(c, 5, 4, 4, 2); px(c, 4, 6, 2, 2);
      c.fillStyle = P.rockDk;
      px(c, 3, 11, 10, 2); px(c, 10, 6, 3, 5);
      break;
    }
    case T.FENCE: {
      c.fillStyle = P.grass;
      px(c, 0, 0, 16, 16);
      // posts with outline + cap
      for (const fx of [1, 7, 13]) {
        c.fillStyle = P.outline; px(c, fx - 1, 3, 4, 11);
        c.fillStyle = P.wood; px(c, fx, 4, 2, 9);
        c.fillStyle = P.woodLt; px(c, fx, 4, 1, 2);
        c.fillStyle = P.woodDk; px(c, fx, 11, 2, 2);
      }
      // rails
      c.fillStyle = P.outline; px(c, 0, 5, 16, 3); px(c, 0, 9, 16, 3);
      c.fillStyle = P.wood; px(c, 0, 6, 16, 1); px(c, 0, 10, 16, 1);
      c.fillStyle = P.woodLt; px(c, 0, 6, 16, 1);
      c.fillStyle = P.wood; px(c, 0, 10, 16, 1);
      break;
    }
    case T.SIGN: {
      c.fillStyle = P.grass;
      px(c, 0, 0, 16, 16);
      // post
      c.fillStyle = P.outline; px(c, 6, 9, 4, 6);
      c.fillStyle = P.woodDk; px(c, 7, 10, 2, 5);
      // board
      c.fillStyle = P.outline; px(c, 1, 1, 14, 9);
      c.fillStyle = P.wood; px(c, 2, 2, 12, 7);
      c.fillStyle = P.woodLt; px(c, 2, 2, 12, 1); px(c, 2, 2, 1, 7);
      c.fillStyle = P.woodDk; px(c, 2, 8, 12, 1); px(c, 13, 2, 1, 7);
      // text lines
      c.fillStyle = P.trunkDk;
      px(c, 4, 4, 8, 1); px(c, 4, 6, 6, 1);
      break;
    }
    case T.WALL: {
      c.fillStyle = P.wall;
      px(c, 0, 0, 16, 16);
      // horizontal siding
      c.fillStyle = P.wallDk;
      px(c, 0, 5, 16, 1); px(c, 0, 10, 16, 1);
      c.fillStyle = P.pathLt;
      px(c, 0, 6, 16, 1); px(c, 0, 11, 16, 1);
      // foundation shadow
      c.fillStyle = P.wallShadow;
      px(c, 0, 14, 16, 2);
      c.fillStyle = P.outline;
      px(c, 0, 15, 16, 1);
      break;
    }
    case T.ROOF_RED:
    case T.ROOF_BLUE:
    case T.ROOF_GRAY: {
      const base = t === T.ROOF_RED ? P.roofRed : t === T.ROOF_BLUE ? P.roofBlue : P.roofGray;
      const dk = t === T.ROOF_RED ? P.roofRedDk : t === T.ROOF_BLUE ? P.roofBlueDk : P.roofGrayDk;
      const lt = t === T.ROOF_RED ? P.roofRedLt : t === T.ROOF_BLUE ? P.roofBlueLt : P.roofGrayLt;
      c.fillStyle = base;
      px(c, 0, 0, 16, 16);
      // shingle rows
      c.fillStyle = dk;
      px(c, 0, 4, 16, 1); px(c, 0, 9, 16, 1); px(c, 0, 14, 16, 1);
      // staggered shingle seams
      for (let row = 0; row < 3; row++) {
        const oy = row * 5 + (row === 0 ? 0 : 0);
        for (let i = 0; i < 4; i++) {
          const ox = i * 4 + (row % 2 === 0 ? 2 : 0);
          px(c, ox, oy + 1, 1, 3);
        }
      }
      // ridge highlight
      c.fillStyle = lt;
      px(c, 0, 0, 16, 2);
      break;
    }
    case T.DOOR: {
      c.fillStyle = P.wall;
      px(c, 0, 0, 16, 16);
      c.fillStyle = P.wallDk; px(c, 0, 5, 16, 1); px(c, 0, 10, 16, 1);
      // door with outline
      c.fillStyle = P.outline; px(c, 2, 1, 12, 15);
      c.fillStyle = P.trunkDk; px(c, 3, 2, 10, 13);
      c.fillStyle = P.trunk; px(c, 4, 3, 8, 11);
      c.fillStyle = P.woodLt; px(c, 4, 3, 8, 1); px(c, 4, 3, 1, 11);
      // inner panel
      c.fillStyle = P.trunkDk; px(c, 6, 5, 5, 6);
      c.fillStyle = P.trunk; px(c, 7, 6, 3, 4);
      // knob
      c.fillStyle = "#f8d048"; px(c, 11, 9, 1, 2);
      break;
    }
    case T.WINDOW: {
      c.fillStyle = P.wall;
      px(c, 0, 0, 16, 16);
      c.fillStyle = P.wallDk; px(c, 0, 5, 16, 1); px(c, 0, 10, 16, 1);
      c.fillStyle = P.outline; px(c, 2, 2, 12, 12);
      c.fillStyle = "#7cc8f0"; px(c, 3, 3, 10, 10);
      // diagonal shine
      c.fillStyle = "#c8ecfc";
      px(c, 4, 4, 2, 1); px(c, 3, 5, 1, 2); px(c, 9, 3, 1, 1); px(c, 10, 4, 1, 2);
      // cross frame
      c.fillStyle = P.outline; px(c, 7, 3, 2, 10); px(c, 3, 7, 10, 2);
      c.fillStyle = P.wallDk; px(c, 7, 4, 1, 8); px(c, 4, 7, 8, 1);
      break;
    }
    case T.FLOOR: {
      c.fillStyle = P.floor;
      px(c, 0, 0, 16, 16);
      // plank rows + staggered seams
      c.fillStyle = P.floorDk;
      px(c, 0, 4, 16, 1); px(c, 0, 9, 16, 1); px(c, 0, 14, 16, 1);
      px(c, 5, 0, 1, 4); px(c, 11, 5, 1, 4); px(c, 3, 10, 1, 4);
      c.fillStyle = P.floorLt;
      px(c, 1, 1, 3, 1); px(c, 8, 6, 3, 1); px(c, 12, 11, 3, 1);
      break;
    }
    case T.GYM_FLOOR: {
      c.fillStyle = P.gym;
      px(c, 0, 0, 16, 16);
      c.fillStyle = P.gymDk;
      px(c, 0, 0, 8, 8); px(c, 8, 8, 8, 8);
      c.fillStyle = "#e8eef8";
      px(c, 8, 0, 8, 1); px(c, 0, 8, 8, 1);
      c.fillStyle = "#9aa6c0";
      px(c, 0, 15, 16, 1);
      break;
    }
    case T.IWALL: {
      c.fillStyle = P.iwall;
      px(c, 0, 0, 16, 16);
      c.fillStyle = P.iwallLt; px(c, 0, 0, 16, 3);
      c.fillStyle = P.iwallDk; px(c, 0, 9, 16, 7);
      c.fillStyle = "#6a7490"; px(c, 0, 9, 16, 1);
      c.fillStyle = P.outline; px(c, 0, 15, 16, 1);
      break;
    }
    case T.RUG: {
      c.fillStyle = "#c84040";
      px(c, 0, 0, 16, 16);
      c.fillStyle = "#e87060"; px(c, 1, 1, 14, 14);
      c.fillStyle = "#c84040"; px(c, 3, 3, 10, 10);
      c.fillStyle = "#f8d048"; px(c, 7, 7, 2, 2);
      c.fillStyle = "#9c2c34"; px(c, 0, 15, 16, 1); px(c, 0, 0, 16, 1);
      break;
    }
    case T.MAT: {
      c.fillStyle = P.floor;
      px(c, 0, 0, 16, 16);
      c.fillStyle = P.outline; px(c, 1, 2, 14, 12);
      c.fillStyle = "#46a848"; px(c, 2, 3, 12, 10);
      c.fillStyle = "#5cc05c"; px(c, 3, 4, 10, 3);
      c.fillStyle = "#2e8a38"; px(c, 3, 10, 10, 2); px(c, 4, 6, 8, 1); px(c, 4, 8, 8, 1);
      break;
    }
    case T.TABLE: {
      c.fillStyle = P.floor;
      px(c, 0, 0, 16, 16);
      c.fillStyle = P.outline; px(c, 1, 2, 14, 11);
      c.fillStyle = P.wood; px(c, 2, 3, 12, 8);
      c.fillStyle = P.woodLt; px(c, 2, 3, 12, 2);
      c.fillStyle = P.woodDk; px(c, 2, 9, 12, 2);
      // legs
      c.fillStyle = P.trunkDk; px(c, 2, 13, 2, 3); px(c, 12, 13, 2, 3);
      break;
    }
    case T.SHELF: {
      c.fillStyle = P.woodDk;
      px(c, 0, 0, 16, 16);
      c.fillStyle = P.outline; px(c, 0, 0, 16, 1); px(c, 0, 7, 16, 2); px(c, 0, 15, 16, 1);
      const cols = ["#e85048", "#4880d8", "#46a848", "#f8c818", "#a85ab8", "#f07898"];
      for (let s = 0; s < 2; s++) {
        const sy = s === 0 ? 1 : 9;
        for (let i = 0; i < 5; i++) {
          c.fillStyle = cols[Math.floor(hash(i, seed + s, 7) * cols.length)];
          px(c, 1 + i * 3, sy, 2, 6);
          c.fillStyle = "rgba(0,0,0,.25)";
          px(c, 1 + i * 3, sy + 4, 2, 2);
        }
      }
      break;
    }
    case T.BED: {
      c.fillStyle = P.floor;
      px(c, 0, 0, 16, 16);
      c.fillStyle = P.outline; px(c, 1, 0, 14, 16);
      c.fillStyle = "#d04848"; px(c, 2, 6, 12, 9);
      c.fillStyle = "#e87060"; px(c, 2, 6, 12, 2);
      // pillow + sheet
      c.fillStyle = "#f8f8f8"; px(c, 2, 1, 12, 5);
      c.fillStyle = "#d8dce8"; px(c, 2, 5, 12, 1); px(c, 12, 1, 2, 4);
      c.fillStyle = "#9c2c34"; px(c, 2, 14, 12, 1);
      break;
    }
    case T.PC: {
      c.fillStyle = P.floor;
      px(c, 0, 0, 16, 16);
      c.fillStyle = P.outline; px(c, 2, 1, 12, 13);
      c.fillStyle = "#8890a8"; px(c, 3, 2, 10, 11);
      // screen glows green/blue
      c.fillStyle = frame === 0 ? "#58d858" : "#40b8e8";
      px(c, 4, 3, 8, 7);
      c.fillStyle = frame === 0 ? "#a8f0a8" : "#a0e0f8";
      px(c, 5, 4, 3, 1);
      // base
      c.fillStyle = "#5a6278"; px(c, 5, 13, 6, 2);
      c.fillStyle = P.outline; px(c, 4, 15, 8, 1);
      break;
    }
    case T.COUNTER: {
      c.fillStyle = P.woodLt;
      px(c, 0, 0, 16, 16);
      c.fillStyle = "#f4dcae"; px(c, 0, 0, 16, 5);
      c.fillStyle = P.outline; px(c, 0, 5, 16, 1);
      c.fillStyle = P.wood; px(c, 0, 6, 16, 8);
      c.fillStyle = P.woodDk; px(c, 0, 12, 16, 2);
      c.fillStyle = P.outline; px(c, 0, 14, 16, 2);
      break;
    }
    case T.HEALER: {
      c.fillStyle = P.floor;
      px(c, 0, 0, 16, 16);
      c.fillStyle = P.outline; px(c, 1, 3, 14, 12);
      c.fillStyle = "#c8d0dc"; px(c, 2, 4, 12, 10);
      c.fillStyle = "#9aa6c0"; px(c, 2, 11, 12, 3);
      // six ball slots, blinking
      const lit = frame === 0;
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 2; j++) {
          c.fillStyle = (i + j) % 2 === (lit ? 0 : 1) ? "#e85048" : "#58d858";
          px(c, 4 + i * 3, 6 + j * 3, 2, 2);
        }
      }
      break;
    }
    case T.CAVE_FLOOR: {
      c.fillStyle = P.caveF;
      px(c, 0, 0, 16, 16);
      c.fillStyle = P.caveFDk;
      for (let i = 0; i < 6; i++) {
        const x = Math.floor(hash(i, seed, 9) * 13);
        const y = Math.floor(hash(seed, i, 10) * 13);
        px(c, x, y, 2, 1); px(c, x + 1, y + 1, 1, 1);
      }
      c.fillStyle = "#b49a80";
      px(c, Math.floor(hash(seed, 3, 4) * 13), Math.floor(hash(4, seed, 5) * 13), 1, 1);
      break;
    }
    case T.CAVE_WALL: {
      c.fillStyle = P.caveW;
      px(c, 0, 0, 16, 16);
      // rocky facets
      c.fillStyle = P.caveWLt;
      px(c, 1, 1, 6, 4); px(c, 9, 3, 5, 4); px(c, 3, 8, 5, 4);
      c.fillStyle = P.caveWDk;
      px(c, 7, 1, 2, 5); px(c, 2, 5, 5, 1); px(c, 8, 7, 6, 2); px(c, 0, 12, 16, 1);
      c.fillStyle = P.outline;
      px(c, 0, 14, 16, 2);
      break;
    }
    case T.LEDGE: {
      c.fillStyle = P.grass;
      px(c, 0, 0, 16, 16);
      c.fillStyle = P.grassDk; px(c, 2, 2, 3, 1); px(c, 10, 4, 3, 1);
      // cliff face
      c.fillStyle = P.outline; px(c, 0, 8, 16, 1);
      c.fillStyle = P.path; px(c, 0, 9, 16, 4);
      c.fillStyle = P.pathDk; px(c, 0, 11, 16, 2); px(c, 4, 9, 1, 3); px(c, 11, 9, 1, 3);
      c.fillStyle = P.outline; px(c, 0, 13, 16, 1);
      c.fillStyle = P.grassDk; px(c, 0, 14, 16, 2);
      break;
    }
    case T.SAND: {
      c.fillStyle = P.sand;
      px(c, 0, 0, 16, 16);
      c.fillStyle = P.sandDk;
      for (let i = 0; i < 5; i++) {
        const x = Math.floor(hash(i, seed, 11) * 13);
        const y = Math.floor(hash(seed, i, 12) * 13);
        px(c, x, y, 2, 1); px(c, x + 3, y + 1, 1, 1);
      }
      break;
    }
    case T.STATUE: {
      c.fillStyle = P.gym;
      px(c, 0, 0, 16, 16);
      c.fillStyle = P.outline; px(c, 3, 1, 10, 14);
      c.fillStyle = P.roofGrayLt; px(c, 4, 2, 8, 9);
      c.fillStyle = P.roofGray; px(c, 4, 7, 8, 4);
      // pokeball motif
      c.fillStyle = "#e85048"; px(c, 6, 3, 4, 2);
      c.fillStyle = "#f8f8f8"; px(c, 6, 5, 4, 2);
      c.fillStyle = P.outline; px(c, 6, 4, 4, 1);
      // pedestal
      c.fillStyle = P.roofGrayDk; px(c, 4, 11, 8, 3);
      c.fillStyle = P.roofGrayLt; px(c, 4, 11, 8, 1);
      break;
    }
    case T.CUT_TREE: {
      c.fillStyle = P.grass;
      px(c, 0, 0, 16, 16);
      c.fillStyle = P.outline; px(c, 3, 3, 10, 11);
      c.fillStyle = P.treeDk; px(c, 4, 4, 8, 9);
      c.fillStyle = P.treeMd; px(c, 4, 4, 8, 5);
      c.fillStyle = P.treeLt; px(c, 5, 5, 3, 2); px(c, 9, 6, 2, 2);
      c.fillStyle = P.trunkDk; px(c, 7, 13, 2, 2);
      break;
    }
    case T.ROCK_SMASH: {
      c.fillStyle = P.path;
      px(c, 0, 0, 16, 16);
      c.fillStyle = P.outline; px(c, 2, 3, 12, 11);
      c.fillStyle = P.rock; px(c, 3, 4, 10, 9);
      c.fillStyle = P.rockLt; px(c, 4, 5, 4, 3);
      c.fillStyle = P.rockDk; px(c, 3, 11, 10, 2); px(c, 9, 5, 3, 5);
      // crack
      c.fillStyle = P.outline;
      px(c, 7, 4, 1, 3); px(c, 8, 7, 1, 2); px(c, 7, 9, 1, 3);
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
// Character sprites — 16×20 GBA-chibi templates with outlines & 2-tone shading
// ---------------------------------------------------------------------------

export interface CharPalette {
  hair: string;  // hat or hair
  skin: string;
  shirt: string;
  pants: string;
  accent?: string;
}

export const PALETTES: Record<string, CharPalette> = {
  hero:      { hair: "#e03028", skin: "#f8c896", shirt: "#3060b0", pants: "#404870", accent: "#f8f8f8" },
  rival:     { hair: "#8050b8", skin: "#f8c896", shirt: "#404048", pants: "#7a5228", accent: "#f8f8f8" },
  professor: { hair: "#9a9aa2", skin: "#f0c8a0", shirt: "#f0f0f4", pants: "#6a5a40", accent: "#c8c8d0" },
  mom:       { hair: "#b06838", skin: "#f8d0a8", shirt: "#f08098", pants: "#f0e8d8", accent: "#f8f8f8" },
  nurse:     { hair: "#f088a8", skin: "#f8d0a8", shirt: "#f8f0f0", pants: "#f8b8c8", accent: "#e03028" },
  clerk:     { hair: "#4a4a58", skin: "#f0c8a0", shirt: "#4880d8", pants: "#404870", accent: "#f8f8f8" },
  boy:       { hair: "#7a5228", skin: "#f8c896", shirt: "#46a848", pants: "#8a6a3a", accent: "#f8f8f8" },
  girl:      { hair: "#d8a030", skin: "#f8d0a8", shirt: "#e85048", pants: "#f8f8f8", accent: "#f8f8f8" },
  oldman:    { hair: "#d8d8d8", skin: "#e8b888", shirt: "#787888", pants: "#585868", accent: "#f8f8f8" },
  leader:    { hair: "#6a4a22", skin: "#e8b070", shirt: "#b8a030", pants: "#5a4a48", accent: "#f8f8f8" },
  bugcatcher:{ hair: "#3a3a3a", skin: "#f8c896", shirt: "#f8e858", pants: "#5878c8", accent: "#f8f8f8" },
  lass:      { hair: "#5878c8", skin: "#f8d0a8", shirt: "#78c8f0", pants: "#3a5aa8", accent: "#f8f8f8" },
};

/** darken a hex color by factor (0..1) */
function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.floor(((n >> 16) & 255) * f);
  const g = Math.floor(((n >> 8) & 255) * f);
  const b = Math.floor((n & 255) * f);
  return `rgb(${r},${g},${b})`;
}

// template letters: . none | # outline | h/H hat-hair lt/dk | k/K skin lt/dk
// e eye | s/S shirt lt/dk | p/P pants lt/dk | o shoe | w white | a accent
const TPL_DOWN_A = [
  "................",
  ".....######.....",
  "....#hhhhhh#....",
  "...#hhhhhhhh#...",
  "..#hhhhhhhhhh#..",
  "..#hwwhhhhhhh#..",
  ".#HHHHHHHHHHHH#.",
  "..#kkkkkkkkkk#..",
  "..#kekkkkkkek#..",
  "..#kkkkkkkkkk#..",
  "...#kKkkkkKk#...",
  "....##kkkk##....",
  "..#ssssssssss#..",
  ".#KssssssssssK#.",
  ".#KsSsssssssSK#.",
  "..#pppppppppp#..",
  "..#ppp####ppp#..",
  "..#Ppp#..#ppP#..",
  "..#ooo#..#ooo#..",
  "..#####..#####..",
];
const TPL_DOWN_B = [
  "................",
  ".....######.....",
  "....#hhhhhh#....",
  "...#hhhhhhhh#...",
  "..#hhhhhhhhhh#..",
  "..#hwwhhhhhhh#..",
  ".#HHHHHHHHHHHH#.",
  "..#kkkkkkkkkk#..",
  "..#kekkkkkkek#..",
  "..#kkkkkkkkkk#..",
  "...#kKkkkkKk#...",
  "....##kkkk##....",
  "..#ssssssssss#..",
  ".#KssssssssssK#.",
  ".#KsSsssssssSK#.",
  "..#pppppppppp#..",
  "...#pp####ppp#..",
  "...#pP#..#ppP#..",
  "....#oo#.#ooo#..",
  "....####.#####..",
];
const TPL_UP_A = [
  "................",
  ".....######.....",
  "....#hhhhhh#....",
  "...#hhhhhhhh#...",
  "..#hhhhhhhhhh#..",
  "..#hhhhhhhhhh#..",
  ".#HhhhhhhhhhhH#.",
  ".#HhhhhhhhhhhH#.",
  ".#HHhhhhhhhhHH#.",
  "..#Hhhhhhhhh#...",
  "...#HhhhhhhH#...",
  "....##hhhh##....",
  "..#ssssssssss#..",
  ".#KsaaaaaaaasK#.",
  ".#KsaaaaaaaasK#.",
  "..#pppppppppp#..",
  "..#ppp####ppp#..",
  "..#Ppp#..#ppP#..",
  "..#ooo#..#ooo#..",
  "..#####..#####..",
];
const TPL_UP_B = TPL_UP_A.map((r, i) =>
  i === 16 ? "...#pp####ppp#.." :
  i === 17 ? "...#pP#..#ppP#.." :
  i === 18 ? "....#oo#.#ooo#.." :
  i === 19 ? "....####.#####.." : r
);
const TPL_SIDE_A = [
  "................",
  "....######......",
  "...#hhhhhh#.....",
  "..#hhhhhhhh#....",
  ".#hhhhhhhhhh#...",
  ".#hhhhhhhhhh#...",
  ".#HHHHHHHHHHH#..",
  ".#kkkkkkkkkH#...",
  ".#kekkkkkkkH#...",
  ".#kkkkkkkkkH#...",
  "..#KkkkkkkK#....",
  "...##kkkk##.....",
  "...#ssssss#.....",
  "..#Kssssss#.....",
  "..#Kssssss#.....",
  "...#pppppp#.....",
  "...#pp##pp#.....",
  "...#pP#.#pP#....",
  "...#oo#.#oo#....",
  "...####.####....",
];
const TPL_SIDE_B = [
  "................",
  "....######......",
  "...#hhhhhh#.....",
  "..#hhhhhhhh#....",
  ".#hhhhhhhhhh#...",
  ".#hhhhhhhhhh#...",
  ".#HHHHHHHHHHH#..",
  ".#kkkkkkkkkH#...",
  ".#kekkkkkkkH#...",
  ".#kkkkkkkkkH#...",
  "..#KkkkkkkK#....",
  "...##kkkk##.....",
  "...#ssssss#.....",
  "..#Kssssss#.....",
  "..#Kssssss#.....",
  "...#pppppp#.....",
  "..#ppp##ppp#....",
  "..#Pp#...#pP#...",
  "..#oo#...#oo#...",
  "..####...####...",
];

const charCache = new Map<string, HTMLCanvasElement>();

/** dir: 0 down, 1 up, 2 left, 3 right; frame 0/1. Returns a 16×20 canvas. */
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
  cv.width = 16;
  cv.height = SPRITE_H;
  const c = cv.getContext("2d")!;
  const colors: Record<string, string> = {
    "#": "#1a1c24",
    h: pal.hair, H: shade(pal.hair, 0.62),
    k: pal.skin, K: shade(pal.skin, 0.72),
    e: "#1a1c24",
    s: pal.shirt, S: shade(pal.shirt, 0.66),
    p: pal.pants, P: shade(pal.pants, 0.62),
    o: "#2a2c38",
    w: "#f8f8f8",
    a: pal.accent ?? "#f8f8f8",
  };
  const flip = dir === 3;
  for (let y = 0; y < SPRITE_H; y++) {
    const row = tpl[y] ?? "";
    for (let x = 0; x < 16; x++) {
      const ch = row[x];
      if (!ch || ch === ".") continue;
      c.fillStyle = colors[ch] ?? "#000";
      c.fillRect(flip ? 15 - x : x, y, 1, 1);
    }
  }
  charCache.set(key, cv);
  return cv;
}
