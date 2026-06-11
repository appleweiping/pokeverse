"use client";
import { create } from "zustand";
import type { Mon, SaveData } from "../types";
import { BattleSession, type BattleResult, type TrainerInfo } from "./battle";
import { createMon, evolveMon, healMon, itemEvolution, learnMove, levelEvolution, maxHPOf } from "./factory";
import { getSpecies } from "../data/dex";
import { ITEMS } from "./items";
import { audio } from "../audio/tracks";
import { tr } from "../i18n";
import type { TrainerDef } from "./maps";

const SAVE_KEY = "pv.save.v1";
const SETTINGS_KEY = "pv.settings.v1";

export type Phase = "title" | "naming" | "overworld" | "battle";
export type SubMenu = "party" | "bag" | "save" | "settings" | "trainer" | "box" | "shop" | null;

export interface DialogueState {
  lines: string[];
  idx: number;
  resolve?: () => void;
}
export interface ChoiceState {
  prompt: string;
  options: { label: string; value: string }[];
  resolve?: (v: string | null) => void;
}
export interface EvolutionState {
  uid: string;
  fromId: number;
  toId: number;
  resolve?: () => void;
}
export interface Settings {
  musicOn: boolean;
  sfxOn: boolean;
  volume: number;
  textSpeed: number; // ms per char
}

export interface LearnRequest {
  uid: string;
  moveId: number;
}

function defaultSettings(): Settings {
  return { musicOn: true, sfxOn: true, volume: 0.7, textSpeed: 22 };
}

export function newSave(playerName: string): SaveData {
  return {
    version: 1,
    playerName,
    trainerId: String(Math.floor(10000 + Math.random() * 90000)),
    mapId: "player-home",
    x: 4,
    y: 4,
    dir: "down",
    party: [],
    box: [],
    bag: { potion: 2 },
    money: 3000,
    badges: [],
    flags: { lastHealMapId: "player-home", lastHealX: 4, lastHealY: 4 },
    dexSeen: [],
    dexCaught: [],
    playSeconds: 0,
    savedAt: Date.now(),
  };
}

interface GameStore {
  phase: Phase;
  save: SaveData | null;
  settings: Settings;
  dialogue: DialogueState | null;
  choice: ChoiceState | null;
  evolution: EvolutionState | null;
  menuOpen: boolean;
  submenu: SubMenu;
  battleSession: BattleSession | null;
  battleTrainer: TrainerInfo | null;
  toast: string | null;
  /** bumps whenever party/bag mutate so React re-renders */
  tick: number;

  // lifecycle
  loadSettings: () => void;
  setSettings: (p: Partial<Settings>) => void;
  hasSave: () => SaveData | null;
  startNew: (name: string) => void;
  continueGame: () => boolean;
  persist: () => void;
  exportSave: () => string | null;
  importSave: (code: string) => boolean;
  deleteSave: () => void;
  toTitle: () => void;

  // ui plumbing
  showDialogue: (lines: string[]) => Promise<void>;
  advanceDialogue: () => void;
  askChoice: (prompt: string, options: { label: string; value: string }[]) => Promise<string | null>;
  pickChoice: (v: string | null) => void;
  setMenu: (open: boolean) => void;
  setSubmenu: (s: SubMenu) => void;
  showToast: (msg: string) => void;
  bump: () => void;

  // gameplay
  markSeen: (id: number) => void;
  markCaught: (id: number) => void;
  giveItem: (item: string, qty: number) => void;
  setFlag: (k: string, v: number) => void;
  flag: (k: string) => number;
  healParty: () => Promise<void>;
  startWildBattle: (speciesId: number, level: number) => Promise<void>;
  startTrainerBattle: (def: TrainerDef) => Promise<void>;
  endBattle: (result: BattleResult) => Promise<void>;
  runLearnFlow: (reqs: LearnRequest[]) => Promise<void>;
  runEvolutionChecks: (uids: Set<string>) => Promise<void>;
  useItemOutside: (itemId: string, partyIdx: number) => Promise<boolean>;
  buyItem: (itemId: string) => boolean;
}

export const useGame = create<GameStore>((set, get) => ({
  phase: "title",
  save: null,
  settings: defaultSettings(),
  dialogue: null,
  choice: null,
  evolution: null,
  menuOpen: false,
  submenu: null,
  battleSession: null,
  battleTrainer: null,
  toast: null,
  tick: 0,

  // ----------------------------------------------------------- lifecycle
  loadSettings: () => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const s = { ...defaultSettings(), ...JSON.parse(raw) } as Settings;
        set({ settings: s });
        audio.setMaster(s.volume);
        audio.setMusicOn(s.musicOn);
        audio.setSfxOn(s.sfxOn);
      }
    } catch {}
  },
  setSettings: (p) => {
    const s = { ...get().settings, ...p };
    set({ settings: s });
    audio.setMaster(s.volume);
    audio.setMusicOn(s.musicOn);
    audio.setSfxOn(s.sfxOn);
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {}
  },
  hasSave: () => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? (JSON.parse(raw) as SaveData) : null;
    } catch { return null; }
  },
  startNew: (name) => {
    set({ save: newSave(name || "RED"), phase: "overworld", menuOpen: false, submenu: null });
  },
  continueGame: () => {
    const s = get().hasSave();
    if (!s) return false;
    set({ save: s, phase: "overworld", menuOpen: false, submenu: null });
    return true;
  },
  persist: () => {
    const s = get().save;
    if (!s) return;
    s.savedAt = Date.now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch {}
  },
  exportSave: () => {
    const s = get().save ?? get().hasSave();
    if (!s) return null;
    try {
      return "PV1." + btoa(unescape(encodeURIComponent(JSON.stringify(s))));
    } catch { return null; }
  },
  importSave: (code) => {
    try {
      const body = code.trim().replace(/^PV1\./, "");
      const data = JSON.parse(decodeURIComponent(escape(atob(body)))) as SaveData;
      if (!data || data.version !== 1 || !Array.isArray(data.party)) return false;
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch { return false; }
  },
  deleteSave: () => {
    try { localStorage.removeItem(SAVE_KEY); } catch {}
    set({ save: null });
  },
  toTitle: () => {
    get().persist();
    audio.stopMusic();
    set({ phase: "title", menuOpen: false, submenu: null, battleSession: null });
  },

  // ----------------------------------------------------------- ui plumbing
  showDialogue: (lines) =>
    new Promise<void>((resolve) => {
      set({ dialogue: { lines, idx: 0, resolve } });
    }),
  advanceDialogue: () => {
    const d = get().dialogue;
    if (!d) return;
    if (d.idx < d.lines.length - 1) {
      set({ dialogue: { ...d, idx: d.idx + 1 } });
    } else {
      set({ dialogue: null });
      d.resolve?.();
    }
  },
  askChoice: (prompt, options) =>
    new Promise<string | null>((resolve) => {
      set({ choice: { prompt, options, resolve } });
    }),
  pickChoice: (v) => {
    const c = get().choice;
    if (!c) return;
    set({ choice: null });
    c.resolve?.(v);
  },
  setMenu: (open) => set({ menuOpen: open, submenu: open ? get().submenu : null }),
  setSubmenu: (s) => set({ submenu: s }),
  showToast: (msg) => {
    set({ toast: msg });
    setTimeout(() => set((st) => (st.toast === msg ? { toast: null } : {})), 2200);
  },
  bump: () => set((s) => ({ tick: s.tick + 1 })),

  // ----------------------------------------------------------- gameplay
  markSeen: (id) => {
    const s = get().save;
    if (s && !s.dexSeen.includes(id)) { s.dexSeen.push(id); get().bump(); }
  },
  markCaught: (id) => {
    const s = get().save;
    if (s) {
      if (!s.dexSeen.includes(id)) s.dexSeen.push(id);
      if (!s.dexCaught.includes(id)) s.dexCaught.push(id);
      get().bump();
    }
  },
  giveItem: (item, qty) => {
    const s = get().save;
    if (!s) return;
    s.bag[item] = (s.bag[item] ?? 0) + qty;
    get().bump();
  },
  setFlag: (k, v) => {
    const s = get().save;
    if (s) { s.flags[k] = v; get().bump(); }
  },
  flag: (k) => {
    const v = get().save?.flags[k] ?? 0;
    return typeof v === "number" ? v : Number(v) || 0;
  },

  healParty: async () => {
    const s = get().save;
    if (!s) return;
    for (const mon of s.party) {
      const sp = await getSpecies(mon.speciesId);
      healMon(mon, sp);
    }
    get().bump();
  },

  startWildBattle: async (speciesId, level) => {
    const s = get().save;
    if (!s || s.party.every((m) => m.curHP <= 0)) return;
    audio.sfx("encounter");
    const wild = await createMon(speciesId, level, "WILD");
    const session = await BattleSession.create("wild", s.party, [wild]);
    get().markSeen(speciesId);
    audio.playMusic("battle_wild");
    set({ phase: "battle", battleSession: session, battleTrainer: null, menuOpen: false, submenu: null });
  },

  startTrainerBattle: async (def) => {
    const s = get().save;
    if (!s) return;
    const team: Mon[] = [];
    for (const t of def.team) {
      team.push(await createMon(t.speciesId, t.level, "TRAINER"));
      get().markSeen(t.speciesId);
    }
    const info: TrainerInfo = { id: def.id, nameKey: def.nameKey, prize: def.prize, badge: def.badge };
    const session = await BattleSession.create("trainer", s.party, team, { trainer: info });
    audio.playMusic(def.theme ?? (def.badge ? "gym" : "battle_trainer"));
    set({ phase: "battle", battleSession: session, battleTrainer: info, menuOpen: false, submenu: null });
  },

  endBattle: async (result) => {
    const g = get();
    const s = g.save;
    const session = g.battleSession;
    set({ phase: "overworld", battleSession: null, battleTrainer: null });
    if (!s || !session) return;

    if (result === "caught") {
      const mon = session.enemyParty[session.enemyIdx];
      g.markCaught(mon.speciesId);
      mon.ot = s.playerName;
      if (s.party.length < 6) s.party.push(mon);
      else {
        s.box.push(mon);
        const sp = await getSpecies(mon.speciesId);
        await g.showDialogue([
          tr("game.battle.sent_to_box", { name: sp.n.hans ?? sp.n.en ?? "?" }),
        ]);
      }
    }

    if (result === "win" && session.trainer) {
      s.money += session.trainer.prize;
      if (session.trainer.badge && !s.badges.includes(session.trainer.badge)) {
        s.badges.push(session.trainer.badge);
        audio.sfx("badge");
      }
      s.flags["tr:" + session.trainer.id] = 1;
    }
    if (result === "win" && session.kind === "trainer") audio.sfx("levelup");

    if (result === "lose") {
      s.money = Math.max(0, Math.floor(s.money / 2));
      for (const mon of s.party) {
        const sp = await getSpecies(mon.speciesId);
        healMon(mon, sp);
      }
      // respawn at last heal point
      const healMap = s.flags.lastHealMapId;
      s.mapId = typeof healMap === "string" && healMap ? healMap : "player-home";
      s.x = Number(s.flags.lastHealX) || 4;
      s.y = Number(s.flags.lastHealY) || 4;
      s.dir = "down";
    }

    g.persist();
    g.bump();

    // post-battle: move learning, then evolutions
    await g.runLearnFlow(session.pendingLearns);
    if (result === "win" || result === "caught") {
      await g.runEvolutionChecks(session.expEarnedBy);
    }
  },

  runLearnFlow: async (reqs) => {
    const g = get();
    const s = g.save;
    if (!s) return;
    const { getMoveMap } = await import("../data/dex");
    const moveMap = await getMoveMap();
    const { localName } = await import("../data/dex");
    const { currentLocale } = await import("../i18n");
    for (const req of reqs) {
      const mon = s.party.find((m) => m.uid === req.uid);
      if (!mon || mon.moves.some((m) => m.id === req.moveId)) continue;
      const mv = moveMap.get(req.moveId);
      if (!mv) continue;
      const sp = await getSpecies(mon.speciesId);
      const monName = mon.nickname ?? localName(sp.n, currentLocale());
      const moveName = localName(mv.n, currentLocale());
      if (mon.moves.length < 4) {
        learnMove(mon, mv.id, mv.pp);
        await g.showDialogue([tr("game.battle.learned", { name: monName, move: moveName })]);
      } else {
        await g.showDialogue([tr("game.battle.wants_learn", { name: monName, move: moveName })]);
        const opts = mon.moves.map((m, i) => ({
          label: localName(moveMap.get(m.id)?.n, currentLocale()),
          value: String(i),
        }));
        opts.push({ label: tr("game.bag.give_up"), value: "skip" });
        const pick = await g.askChoice(tr("game.battle.which_forget"), opts);
        if (pick !== null && pick !== "skip") {
          learnMove(mon, mv.id, mv.pp, Number(pick));
          await g.showDialogue([tr("game.battle.learned", { name: monName, move: moveName })]);
        } else {
          await g.showDialogue([tr("game.battle.not_learned", { name: monName, move: moveName })]);
        }
      }
      g.bump();
    }
  },

  runEvolutionChecks: async (uids) => {
    const g = get();
    const s = g.save;
    if (!s) return;
    for (const mon of s.party) {
      if (!uids.has(mon.uid)) continue;
      const sp = await getSpecies(mon.speciesId);
      const toId = levelEvolution(mon, sp);
      if (!toId) continue;
      await new Promise<void>((resolve) => {
        set({ evolution: { uid: mon.uid, fromId: mon.speciesId, toId, resolve } });
      });
      g.bump();
    }
  },

  useItemOutside: async (itemId, partyIdx) => {
    const g = get();
    const s = g.save;
    if (!s) return false;
    const def = ITEMS[itemId];
    const mon = s.party[partyIdx];
    if (!def || !mon || (s.bag[itemId] ?? 0) <= 0) return false;
    const sp = await getSpecies(mon.speciesId);
    const maxHp = maxHPOf(mon, sp);
    let used = false;

    // technical machine: teach the move (reusable, not consumed)
    if (def.tmMove) {
      const { loadTmsets, getMoveMap, localName } = await import("../data/dex");
      const { currentLocale } = await import("../i18n");
      const { learnMove } = await import("./factory");
      const tmsets = await loadTmsets();
      const compatible = tmsets[String(mon.speciesId)]?.includes(def.tmMove);
      if (!compatible || mon.moves.some((m) => m.id === def.tmMove)) {
        g.showToast(tr("game.bag.no_effect"));
        return false;
      }
      const moveMap = await getMoveMap();
      const mv = moveMap.get(def.tmMove);
      if (!mv) return false;
      const monName = mon.nickname ?? localName(sp.n, currentLocale());
      const moveName = localName(mv.n, currentLocale());
      if (mon.moves.length < 4) {
        learnMove(mon, mv.id, mv.pp);
        audio.sfx("levelup");
        await g.showDialogue([tr("game.battle.learned", { name: monName, move: moveName })]);
      } else {
        await g.showDialogue([tr("game.battle.wants_learn", { name: monName, move: moveName })]);
        const opts = mon.moves.map((m, i) => ({
          label: localName(moveMap.get(m.id)?.n, currentLocale()),
          value: String(i),
        }));
        opts.push({ label: tr("game.bag.give_up"), value: "skip" });
        const pick = await g.askChoice(tr("game.battle.which_forget"), opts);
        if (pick === null || pick === "skip") {
          await g.showDialogue([tr("game.battle.not_learned", { name: monName, move: moveName })]);
          return false;
        }
        learnMove(mon, mv.id, mv.pp, Number(pick));
        audio.sfx("levelup");
        await g.showDialogue([tr("game.battle.learned", { name: monName, move: moveName })]);
      }
      g.bump();
      g.persist();
      return true;
    }

    if (def.evoItem) {
      const toId = itemEvolution(sp, def.evoItem);
      if (toId) {
        s.bag[itemId]--;
        if (s.bag[itemId] <= 0) delete s.bag[itemId];
        await new Promise<void>((resolve) => {
          set({ evolution: { uid: mon.uid, fromId: mon.speciesId, toId, resolve } });
        });
        g.bump();
        return true;
      }
      g.showToast(tr("game.bag.no_effect"));
      return false;
    }
    if (def.revive) {
      if (mon.curHP > 0) { g.showToast(tr("game.bag.no_effect")); return false; }
      mon.curHP = Math.max(1, Math.floor(maxHp * def.revive));
      used = true;
    } else if (def.heal) {
      if (mon.curHP <= 0 || mon.curHP >= maxHp) { g.showToast(tr("game.bag.no_effect")); return false; }
      mon.curHP = Math.min(maxHp, mon.curHP + def.heal);
      used = true;
    }
    if (def.cure) {
      if (mon.status && (def.cure === "all" || (def.cure as string[]).includes(mon.status))) {
        mon.status = null;
        used = true;
      } else if (!used) {
        g.showToast(tr("game.bag.no_effect"));
        return false;
      }
    }
    if (used) {
      audio.sfx("heal");
      s.bag[itemId]--;
      if (s.bag[itemId] <= 0) delete s.bag[itemId];
      g.bump();
    }
    return used;
  },

  buyItem: (itemId) => {
    const g = get();
    const s = g.save;
    const def = ITEMS[itemId];
    if (!s || !def) return false;
    if (s.money < def.price) {
      g.showToast(tr("game.field.not_enough"));
      audio.sfx("cancel");
      return false;
    }
    s.money -= def.price;
    s.bag[itemId] = (s.bag[itemId] ?? 0) + 1;
    audio.sfx("buy");
    g.bump();
    return true;
  },
}));
