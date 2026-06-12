import type { SaveData } from "../types";

/**
 * Achievement definitions. Conditions read only the save file, so checks are
 * cheap and run after any state bump. Names/descriptions live in i18n under
 * achv.<id>.{n,d}.
 */

export interface AchievementDef {
  id: string;
  icon: string;
  cond: (s: SaveData) => boolean;
}

const stat = (s: SaveData, k: string) => s.stats?.[k] ?? 0;

export const ACHIEVEMENTS: AchievementDef[] = [
  // --- collection
  { id: "first-catch", icon: "🔴", cond: (s) => s.dexCaught.length >= 1 },
  { id: "catch-10", icon: "🎯", cond: (s) => s.dexCaught.length >= 10 },
  { id: "catch-30", icon: "🏹", cond: (s) => s.dexCaught.length >= 30 },
  { id: "catch-60", icon: "🏆", cond: (s) => s.dexCaught.length >= 60 },
  { id: "seen-25", icon: "👀", cond: (s) => s.dexSeen.length >= 25 },
  { id: "seen-75", icon: "🔭", cond: (s) => s.dexSeen.length >= 75 },
  { id: "seen-150", icon: "📡", cond: (s) => s.dexSeen.length >= 150 },
  { id: "shiny", icon: "✨", cond: (s) => [...s.party, ...s.box].some((m) => m.shiny) },
  { id: "full-team", icon: "👥", cond: (s) => s.party.filter((m) => !m.egg).length >= 6 },
  { id: "box-10", icon: "📦", cond: (s) => s.box.length >= 10 },
  // --- badges & story
  { id: "badge-1", icon: "🥉", cond: (s) => s.badges.length >= 1 },
  { id: "badge-2", icon: "🥈", cond: (s) => s.badges.length >= 2 },
  { id: "badge-3", icon: "🥇", cond: (s) => s.badges.length >= 3 },
  { id: "badge-4", icon: "👑", cond: (s) => s.badges.length >= 4 },
  { id: "rival-1", icon: "⚡", cond: (s) => !!s.flags["tr:rival1"] },
  { id: "aurora-1", icon: "🌌", cond: (s) => !!s.flags["tr:auroraboss1"] },
  { id: "surfer", icon: "🌊", cond: (s) => s.badges.includes("tidal") && s.party.some((m) => m.moves.some((mv) => mv.id === 57)) },
  // --- battle
  { id: "wins-10", icon: "⚔️", cond: (s) => stat(s, "battlesWon") >= 10 },
  { id: "wins-50", icon: "🗡️", cond: (s) => stat(s, "battlesWon") >= 50 },
  { id: "wins-150", icon: "🔥", cond: (s) => stat(s, "battlesWon") >= 150 },
  { id: "online-win", icon: "🌐", cond: (s) => stat(s, "onlineWins") >= 1 },
  { id: "online-win-5", icon: "🛰️", cond: (s) => stat(s, "onlineWins") >= 5 },
  { id: "trade-1", icon: "🤝", cond: (s) => stat(s, "trades") >= 1 },
  // --- training
  { id: "level-30", icon: "📈", cond: (s) => s.party.some((m) => m.level >= 30) },
  { id: "level-50", icon: "🚀", cond: (s) => s.party.some((m) => m.level >= 50) },
  { id: "level-80", icon: "🌟", cond: (s) => s.party.some((m) => m.level >= 80) },
  { id: "ev-252", icon: "💪", cond: (s) => [...s.party, ...s.box].some((m) => (m.evs ?? []).some((v) => v >= 252)) },
  { id: "tm-learn", icon: "💿", cond: (s) => stat(s, "tmsTaught") >= 1 },
  { id: "evolved", icon: "🦋", cond: (s) => stat(s, "evolutions") >= 1 },
  // --- wealth & time
  { id: "money-10k", icon: "💰", cond: (s) => s.money >= 10000 },
  { id: "money-50k", icon: "🏦", cond: (s) => s.money >= 50000 },
  { id: "play-1h", icon: "⏰", cond: (s) => s.playSeconds >= 3600 },
  { id: "play-5h", icon: "🕰️", cond: (s) => s.playSeconds >= 18000 },
  // --- post-game (v1.3)
  { id: "tower-7", icon: "🏯", cond: (s) => stat(s, "towerBest") >= 7 },
  { id: "dojo-3", icon: "🥋", cond: (s) => stat(s, "dojoBest") >= 3 },
  { id: "mega-1", icon: "◆", cond: (s) => stat(s, "megaUsed") >= 1 },
  { id: "hatch-1", icon: "🥚", cond: (s) => stat(s, "eggsHatched") >= 1 },
  { id: "legend-duo", icon: "🌈", cond: (s) => s.dexCaught.includes(245) && s.dexCaught.includes(250) },
  { id: "rematch-1", icon: "🔁", cond: (s) => stat(s, "rematchWins") >= 1 },
];

/** Returns newly unlocked achievement ids (and records them on the save). */
export function checkAchievements(s: SaveData): string[] {
  if (!s.achievements) s.achievements = [];
  const fresh: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (s.achievements.includes(a.id)) continue;
    try {
      if (a.cond(s)) {
        s.achievements.push(a.id);
        fresh.push(a.id);
      }
    } catch {}
  }
  return fresh;
}
