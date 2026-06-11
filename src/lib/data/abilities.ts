import type { TypeName } from "../types";

/**
 * Ability effect table. We implement the most impactful ~30 abilities; every
 * other ability is still stored on the mon and shown in the UI, it just has no
 * battle hook (treated as cosmetic). Effects are read by battle.ts at the
 * relevant hook points (switch-in, damage calc, status application, end of turn).
 */

export interface AbilityDef {
  slug: string;
  n: { hans: string; hant: string; en: string; ja: string; ko: string };
  /** boost own damage 1.5× when this type is used AND user HP ≤ 1/3 */
  pinchType?: TypeName;
  /** flat 1.5× to moves of this type (e.g. blaze-less STAB amps) */
  /** halve incoming damage of this type */
  resistType?: TypeName;
  /** absorb moves of this type: heal 1/4 instead of taking damage */
  absorbType?: TypeName;
  /** absorb moves of this type and raise a stat instead */
  absorbBoost?: { type: TypeName; stat: "atk" | "spa" | "spe"; stages: number };
  /** immune to these status conditions */
  statusImmune?: ("par" | "brn" | "psn" | "tox" | "slp" | "frz")[];
  /** lower foe's attack one stage on switch-in */
  intimidate?: boolean;
  /** survive a KO hit from full HP with 1 HP */
  sturdy?: boolean;
  /** 1.3× damage when holding... (n/a here) or boost when status'd */
  guts?: boolean; // 1.5× Atk when statused, ignore burn drop
  /** raise speed one stage when hit by status (n/a) — use weatherSpeed instead */
  /** crit-immune + take less from super-effective (filter/solid-rock) */
  reduceSE?: boolean;
  /** never miss / foe can't raise eva (no-guard simplified: own moves always hit) */
  noGuard?: boolean;
  /** weather set on switch-in */
  weather?: "sun" | "rain" | "sand" | "hail";
  /** levitate: immune to ground */
  levitate?: boolean;
  /** technician: 1.5× to moves with power ≤ 60 */
  technician?: boolean;
  /** hugePower/purePower: double physical attack */
  doubleAtk?: boolean;
  /** speed doubles in matching weather */
  weatherSpeed?: "sun" | "rain";
  /** thick-fat: halve fire & ice damage */
  thickFat?: boolean;
}

export const ABILITIES: Record<string, AbilityDef> = {
  overgrow: { slug: "overgrow", pinchType: "grass", n: { hans: "茂盛", hant: "茂盛", en: "Overgrow", ja: "しんりょく", ko: "심록" } },
  blaze: { slug: "blaze", pinchType: "fire", n: { hans: "猛火", hant: "猛火", en: "Blaze", ja: "もうか", ko: "맹화" } },
  torrent: { slug: "torrent", pinchType: "water", n: { hans: "激流", hant: "激流", en: "Torrent", ja: "げきりゅう", ko: "급류" } },
  swarm: { slug: "swarm", pinchType: "bug", n: { hans: "虫之预感", hant: "蟲之預感", en: "Swarm", ja: "むしのしらせ", ko: "벌레의알림" } },
  intimidate: { slug: "intimidate", intimidate: true, n: { hans: "威吓", hant: "威嚇", en: "Intimidate", ja: "いかく", ko: "위협" } },
  sturdy: { slug: "sturdy", sturdy: true, n: { hans: "结实", hant: "結實", en: "Sturdy", ja: "がんじょう", ko: "옹골참" } },
  levitate: { slug: "levitate", levitate: true, n: { hans: "飘浮", hant: "飄浮", en: "Levitate", ja: "ふゆう", ko: "부유" } },
  "volt-absorb": { slug: "volt-absorb", absorbType: "electric", n: { hans: "蓄电", hant: "蓄電", en: "Volt Absorb", ja: "ちくでん", ko: "축전" } },
  "water-absorb": { slug: "water-absorb", absorbType: "water", n: { hans: "储水", hant: "儲水", en: "Water Absorb", ja: "ちょすい", ko: "저수" } },
  "flash-fire": { slug: "flash-fire", absorbBoost: { type: "fire", stat: "spa", stages: 0 }, resistType: "fire", n: { hans: "引火", hant: "引火", en: "Flash Fire", ja: "もらいび", ko: "타오르는불꽃" } },
  "lightning-rod": { slug: "lightning-rod", absorbBoost: { type: "electric", stat: "spa", stages: 1 }, n: { hans: "避雷针", hant: "避雷針", en: "Lightning Rod", ja: "ひらいしん", ko: "피뢰침" } },
  "storm-drain": { slug: "storm-drain", absorbBoost: { type: "water", stat: "spa", stages: 1 }, n: { hans: "引水", hant: "引水", en: "Storm Drain", ja: "よびみず", ko: "마중물" } },
  "sap-sipper": { slug: "sap-sipper", absorbBoost: { type: "grass", stat: "atk", stages: 1 }, n: { hans: "食草", hant: "食草", en: "Sap Sipper", ja: "そうしょく", ko: "초식" } },
  "motor-drive": { slug: "motor-drive", absorbBoost: { type: "electric", stat: "spe", stages: 1 }, n: { hans: "电气引擎", hant: "電氣引擎", en: "Motor Drive", ja: "でんきエンジン", ko: "전기엔진" } },
  guts: { slug: "guts", guts: true, n: { hans: "毅力", hant: "毅力", en: "Guts", ja: "こんじょう", ko: "근성" } },
  "thick-fat": { slug: "thick-fat", thickFat: true, n: { hans: "厚脂肪", hant: "厚脂肪", en: "Thick Fat", ja: "あついしぼう", ko: "두꺼운지방" } },
  technician: { slug: "technician", technician: true, n: { hans: "技术高手", hant: "技術高手", en: "Technician", ja: "テクニシャン", ko: "테크니션" } },
  "huge-power": { slug: "huge-power", doubleAtk: true, n: { hans: "大力士", hant: "大力士", en: "Huge Power", ja: "ちからもち", ko: "천하장사" } },
  "pure-power": { slug: "pure-power", doubleAtk: true, n: { hans: "瑜伽之力", hant: "瑜伽之力", en: "Pure Power", ja: "ヨガパワー", ko: "순수한힘" } },
  "water-veil": { slug: "water-veil", statusImmune: ["brn"], n: { hans: "水幕", hant: "水幕", en: "Water Veil", ja: "みずのベール", ko: "수의베일" } },
  insomnia: { slug: "insomnia", statusImmune: ["slp"], n: { hans: "不眠", hant: "不眠", en: "Insomnia", ja: "ふみん", ko: "불면" } },
  "vital-spirit": { slug: "vital-spirit", statusImmune: ["slp"], n: { hans: "干劲", hant: "幹勁", en: "Vital Spirit", ja: "やるき", ko: "의욕" } },
  limber: { slug: "limber", statusImmune: ["par"], n: { hans: "柔软", hant: "柔軟", en: "Limber", ja: "じゅうなん", ko: "유연" } },
  immunity: { slug: "immunity", statusImmune: ["psn", "tox"], n: { hans: "免疫", hant: "免疫", en: "Immunity", ja: "めんえき", ko: "면역" } },
  "magma-armor": { slug: "magma-armor", statusImmune: ["frz"], n: { hans: "熔岩铠甲", hant: "熔岩鎧甲", en: "Magma Armor", ja: "マグマのよろい", ko: "마그마의무장" } },
  "water-bubble": { slug: "water-bubble", statusImmune: ["brn"], resistType: "fire", n: { hans: "水泡", hant: "水泡", en: "Water Bubble", ja: "すいほう", ko: "수포" } },
  drought: { slug: "drought", weather: "sun", n: { hans: "日照", hant: "日照", en: "Drought", ja: "ひでり", ko: "가뭄" } },
  drizzle: { slug: "drizzle", weather: "rain", n: { hans: "降雨", hant: "降雨", en: "Drizzle", ja: "あめふらし", ko: "잔비" } },
  "sand-stream": { slug: "sand-stream", weather: "sand", n: { hans: "扬沙", hant: "揚沙", en: "Sand Stream", ja: "すなおこし", ko: "모래날림" } },
  "snow-warning": { slug: "snow-warning", weather: "hail", n: { hans: "降雪", hant: "降雪", en: "Snow Warning", ja: "ゆきふらし", ko: "눈퍼뜨리기" } },
  "swift-swim": { slug: "swift-swim", weatherSpeed: "rain", n: { hans: "悠游自如", hant: "悠游自如", en: "Swift Swim", ja: "すいすい", ko: "쓱쓱" } },
  chlorophyll: { slug: "chlorophyll", weatherSpeed: "sun", n: { hans: "叶绿素", hant: "葉綠素", en: "Chlorophyll", ja: "ようりょくそ", ko: "엽록소" } },
  filter: { slug: "filter", reduceSE: true, n: { hans: "过滤", hant: "過濾", en: "Filter", ja: "フィルター", ko: "필터" } },
  "solid-rock": { slug: "solid-rock", reduceSE: true, n: { hans: "坚硬岩石", hant: "堅硬岩石", en: "Solid Rock", ja: "ハードロック", ko: "하드록" } },
  "no-guard": { slug: "no-guard", noGuard: true, n: { hans: "无防守", hant: "無防守", en: "No Guard", ja: "ノーガード", ko: "노가드" } },
};

export function abilityName(slug: string | undefined, locale: "zh-CN" | "zh-TW" | "en" | "ja" | "ko"): string {
  if (!slug) return "";
  const def = ABILITIES[slug];
  if (!def) {
    // prettify unknown slug as a fallback label
    return slug.split("-").map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ");
  }
  const k = locale === "zh-CN" ? "hans" : locale === "zh-TW" ? "hant" : locale === "ja" ? "ja" : locale === "ko" ? "ko" : "en";
  return def.n[k];
}

/** Strip the hidden-ability "!" prefix. */
export function cleanAbility(slug: string): string {
  return slug.startsWith("!") ? slug.slice(1) : slug;
}
