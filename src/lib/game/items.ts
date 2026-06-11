import type { ItemDef } from "../types";

/** All obtainable items. Names/descriptions live in the i18n dictionaries under items.*. */
export const ITEMS: Record<string, ItemDef> = {
  "poke-ball":      { id: "poke-ball", category: "ball", price: 200, ballMult: 1 },
  "great-ball":     { id: "great-ball", category: "ball", price: 600, ballMult: 1.5 },
  "ultra-ball":     { id: "ultra-ball", category: "ball", price: 1200, ballMult: 2 },
  potion:           { id: "potion", category: "medicine", price: 300, heal: 20 },
  "super-potion":   { id: "super-potion", category: "medicine", price: 700, heal: 60 },
  "hyper-potion":   { id: "hyper-potion", category: "medicine", price: 1500, heal: 120 },
  "max-potion":     { id: "max-potion", category: "medicine", price: 2500, heal: 9999 },
  revive:           { id: "revive", category: "medicine", price: 2000, revive: 0.5 },
  antidote:         { id: "antidote", category: "medicine", price: 200, cure: ["psn", "tox"] },
  "paralyze-heal":  { id: "paralyze-heal", category: "medicine", price: 200, cure: ["par"] },
  awakening:        { id: "awakening", category: "medicine", price: 200, cure: ["slp"] },
  "burn-heal":      { id: "burn-heal", category: "medicine", price: 200, cure: ["brn"] },
  "ice-heal":       { id: "ice-heal", category: "medicine", price: 200, cure: ["frz"] },
  "full-heal":      { id: "full-heal", category: "medicine", price: 500, cure: "all" },
  "full-restore":   { id: "full-restore", category: "medicine", price: 3000, heal: 9999, cure: "all" },
  "fire-stone":     { id: "fire-stone", category: "battle", price: 3000, evoItem: "fire-stone" },
  "water-stone":    { id: "water-stone", category: "battle", price: 3000, evoItem: "water-stone" },
  "thunder-stone":  { id: "thunder-stone", category: "battle", price: 3000, evoItem: "thunder-stone" },
  "leaf-stone":     { id: "leaf-stone", category: "battle", price: 3000, evoItem: "leaf-stone" },
  "moon-stone":     { id: "moon-stone", category: "battle", price: 3000, evoItem: "moon-stone" },
  "town-map":       { id: "town-map", category: "key", price: 0 },
};

/** What the Poké Mart sells (item id + display order). */
export const MART_STOCK: string[] = [
  "poke-ball", "great-ball", "potion", "super-potion", "antidote",
  "paralyze-heal", "awakening", "burn-heal", "revive",
];

export const BALL_ORDER = ["poke-ball", "great-ball", "ultra-ball"];
