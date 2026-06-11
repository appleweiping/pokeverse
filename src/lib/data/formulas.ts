import type { Mon } from "../types";

// ---------------------------------------------------------------------------
// Natures (25) — stat index: 1 atk, 2 def, 3 spa, 4 spd, 5 spe
// ---------------------------------------------------------------------------

export interface Nature {
  key: string;
  up: number; // boosted stat index (0 = neutral)
  down: number;
  n: { hans: string; hant: string; en: string; ja: string; ko: string };
}

export const NATURES: Nature[] = [
  { key: "hardy",   up: 0, down: 0, n: { hans: "勤奋", hant: "勤奮", en: "Hardy",   ja: "がんばりや",  ko: "노력" } },
  { key: "lonely",  up: 1, down: 2, n: { hans: "怕寂寞", hant: "怕寂寞", en: "Lonely",  ja: "さみしがり",  ko: "외로움" } },
  { key: "brave",   up: 1, down: 5, n: { hans: "勇敢", hant: "勇敢", en: "Brave",   ja: "ゆうかん",    ko: "용감" } },
  { key: "adamant", up: 1, down: 3, n: { hans: "固执", hant: "固執", en: "Adamant", ja: "いじっぱり",  ko: "고집" } },
  { key: "naughty", up: 1, down: 4, n: { hans: "顽皮", hant: "頑皮", en: "Naughty", ja: "やんちゃ",    ko: "개구쟁이" } },
  { key: "bold",    up: 2, down: 1, n: { hans: "大胆", hant: "大膽", en: "Bold",    ja: "ずぶとい",    ko: "대담" } },
  { key: "docile",  up: 0, down: 0, n: { hans: "坦率", hant: "坦率", en: "Docile",  ja: "すなお",      ko: "온순" } },
  { key: "relaxed", up: 2, down: 5, n: { hans: "悠闲", hant: "悠閒", en: "Relaxed", ja: "のんき",      ko: "무사태평" } },
  { key: "impish",  up: 2, down: 3, n: { hans: "淘气", hant: "淘氣", en: "Impish",  ja: "わんぱく",    ko: "장난꾸러기" } },
  { key: "lax",     up: 2, down: 4, n: { hans: "乐天", hant: "樂天", en: "Lax",     ja: "のうてんき",  ko: "촐랑" } },
  { key: "timid",   up: 5, down: 1, n: { hans: "胆小", hant: "膽小", en: "Timid",   ja: "おくびょう",  ko: "겁쟁이" } },
  { key: "hasty",   up: 5, down: 2, n: { hans: "急躁", hant: "急躁", en: "Hasty",   ja: "せっかち",    ko: "성급" } },
  { key: "serious", up: 0, down: 0, n: { hans: "认真", hant: "認真", en: "Serious", ja: "まじめ",      ko: "성실" } },
  { key: "jolly",   up: 5, down: 3, n: { hans: "爽朗", hant: "爽朗", en: "Jolly",   ja: "ようき",      ko: "명랑" } },
  { key: "naive",   up: 5, down: 4, n: { hans: "天真", hant: "天真", en: "Naive",   ja: "むじゃき",    ko: "천진난만" } },
  { key: "modest",  up: 3, down: 1, n: { hans: "内敛", hant: "內斂", en: "Modest",  ja: "ひかえめ",    ko: "조심" } },
  { key: "mild",    up: 3, down: 2, n: { hans: "慢吞吞", hant: "慢吞吞", en: "Mild", ja: "おっとり",    ko: "의젓" } },
  { key: "quiet",   up: 3, down: 5, n: { hans: "冷静", hant: "冷靜", en: "Quiet",   ja: "れいせい",    ko: "냉정" } },
  { key: "bashful", up: 0, down: 0, n: { hans: "害羞", hant: "害羞", en: "Bashful", ja: "てれや",      ko: "수줍음" } },
  { key: "rash",    up: 3, down: 4, n: { hans: "马虎", hant: "馬虎", en: "Rash",    ja: "うっかりや",  ko: "덜렁" } },
  { key: "calm",    up: 4, down: 1, n: { hans: "温和", hant: "溫和", en: "Calm",    ja: "おだやか",    ko: "차분" } },
  { key: "gentle",  up: 4, down: 2, n: { hans: "温顺", hant: "溫順", en: "Gentle",  ja: "おとなしい",  ko: "얌전" } },
  { key: "sassy",   up: 4, down: 5, n: { hans: "自大", hant: "自大", en: "Sassy",   ja: "なまいき",    ko: "건방" } },
  { key: "careful", up: 4, down: 3, n: { hans: "慎重", hant: "慎重", en: "Careful", ja: "しんちょう",  ko: "신중" } },
  { key: "quirky",  up: 0, down: 0, n: { hans: "浮躁", hant: "浮躁", en: "Quirky",  ja: "きまぐれ",    ko: "변덕" } },
];

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

/** Compute the 6 actual stats from base stats + IVs + EVs + level + nature. */
export function calcStats(
  base: number[],
  ivs: number[],
  level: number,
  natureIdx: number,
  evs?: number[]
): [number, number, number, number, number, number] {
  const nat = NATURES[natureIdx] ?? NATURES[0];
  const ev = (i: number) => Math.floor((evs?.[i] ?? 0) / 4);
  const out = [0, 0, 0, 0, 0, 0] as [number, number, number, number, number, number];
  out[0] = Math.floor(((2 * base[0] + ivs[0] + ev(0)) * level) / 100) + level + 10;
  for (let i = 1; i < 6; i++) {
    let v = Math.floor(((2 * base[i] + ivs[i] + ev(i)) * level) / 100) + 5;
    if (nat.up === i) v = Math.floor(v * 1.1);
    else if (nat.down === i) v = Math.floor(v * 0.9);
    out[i] = v;
  }
  return out;
}

export const EV_MAX_STAT = 252;
export const EV_MAX_TOTAL = 510;

/** Apply an EV yield to a mon's spread, respecting per-stat and total caps. */
export function applyEvYield(
  evs: [number, number, number, number, number, number],
  yield_: [number, number][]
): boolean {
  let changed = false;
  for (const [idx, amount] of yield_) {
    for (let n = 0; n < amount; n++) {
      const total = evs.reduce((a, b) => a + b, 0);
      if (total >= EV_MAX_TOTAL || evs[idx] >= EV_MAX_STAT) break;
      evs[idx]++;
      changed = true;
    }
  }
  return changed;
}

/** Stat stage multiplier for atk/def/spa/spd/spe (-6..+6). */
export function stageMult(stage: number): number {
  return stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage);
}

/** Accuracy/evasion stage multiplier (-6..+6). */
export function accStageMult(stage: number): number {
  return stage >= 0 ? (3 + stage) / 3 : 3 / (3 - stage);
}

// ---------------------------------------------------------------------------
// Experience — all six official growth curves
// gr index: 0 slow, 1 medium, 2 fast, 3 medium-slow, 4 erratic, 5 fluctuating
// ---------------------------------------------------------------------------

export function expForLevel(gr: number, n: number): number {
  if (n <= 1) return 0;
  switch (gr) {
    case 0: return Math.floor((5 * n ** 3) / 4);
    case 1: return n ** 3;
    case 2: return Math.floor((4 * n ** 3) / 5);
    case 3: return Math.floor((6 / 5) * n ** 3) - 15 * n ** 2 + 100 * n - 140;
    case 4: // erratic
      if (n < 50) return Math.floor((n ** 3 * (100 - n)) / 50);
      if (n < 68) return Math.floor((n ** 3 * (150 - n)) / 100);
      if (n < 98) return Math.floor((n ** 3 * Math.floor((1911 - 10 * n) / 3)) / 500);
      return Math.floor((n ** 3 * (160 - n)) / 100);
    case 5: // fluctuating
      if (n < 15) return Math.floor((n ** 3 * (Math.floor((n + 1) / 3) + 24)) / 50);
      if (n < 36) return Math.floor((n ** 3 * (n + 14)) / 50);
      return Math.floor((n ** 3 * (Math.floor(n / 2) + 32)) / 50);
    default: return n ** 3;
  }
}

export function levelForExp(gr: number, exp: number): number {
  let lv = 1;
  while (lv < 100 && expForLevel(gr, lv + 1) <= exp) lv++;
  return lv;
}

/** Exp awarded for defeating an enemy. */
export function expGain(baseExp: number, enemyLevel: number, isTrainer: boolean): number {
  return Math.max(1, Math.floor(((baseExp * enemyLevel) / 7) * (isTrainer ? 1.5 : 1)));
}

// ---------------------------------------------------------------------------
// Capture (Gen 3/4 shake formula)
// ---------------------------------------------------------------------------

export function attemptCapture(
  maxHP: number,
  curHP: number,
  captureRate: number,
  ballMult: number,
  statusMult: number,
  rng: () => number
): { caught: boolean; shakes: number } {
  const a = Math.max(
    1,
    Math.floor(((3 * maxHP - 2 * curHP) * captureRate * ballMult) / (3 * maxHP)) * statusMult
  );
  if (a >= 255) return { caught: true, shakes: 3 };
  const b = Math.floor(65536 / Math.pow(255 / a, 0.25));
  let shakes = 0;
  for (let i = 0; i < 4; i++) {
    if (Math.floor(rng() * 65536) < b) shakes++;
    else break;
  }
  return { caught: shakes === 4, shakes: Math.min(shakes, 3) };
}

export function statusCatchMult(status: Mon["status"]): number {
  if (status === "slp" || status === "frz") return 2;
  if (status) return 1.5;
  return 1;
}

// ---------------------------------------------------------------------------
// Misc helpers
// ---------------------------------------------------------------------------

export function randomIVs(rng: () => number = Math.random): [number, number, number, number, number, number] {
  return [0, 0, 0, 0, 0, 0].map(() => Math.floor(rng() * 32)) as [number, number, number, number, number, number];
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/** Mulberry32 — tiny seedable PRNG used for deterministic online battles. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
