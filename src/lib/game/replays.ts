import type { BattleEvent } from "./battle";

/**
 * Battle replays — event streams persisted to localStorage. The replay page
 * re-feeds them through a lightweight viewer at adjustable speed.
 */

export interface ReplayTeamEntry {
  speciesId: number;
  level: number;
}

export interface Replay {
  id: string;
  date: number;
  kind: "wild" | "trainer" | "online";
  playerTeam: ReplayTeamEntry[];
  enemyTeam: ReplayTeamEntry[];
  events: BattleEvent[];
  /** for online replays: whether "player" side events belong to the viewer */
  hostPerspective?: boolean;
}

const KEY = "pv.replays.v1";
const MAX_REPLAYS = 10;

export function listReplays(): Replay[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Replay[]) : [];
  } catch {
    return [];
  }
}

export function saveReplay(r: Omit<Replay, "id" | "date">): void {
  try {
    const all = listReplays();
    all.unshift({
      ...r,
      id: Math.random().toString(36).slice(2, 10),
      date: Date.now(),
    });
    // keep the log small: trim long event streams and cap the list
    const trimmed = all.slice(0, MAX_REPLAYS).map((rep) => ({
      ...rep,
      events: rep.events.slice(0, 600),
    }));
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {}
}

export function deleteReplay(id: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(listReplays().filter((r) => r.id !== id)));
  } catch {}
}
